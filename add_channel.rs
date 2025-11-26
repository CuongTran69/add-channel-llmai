//! Add dependencies in the following partial Cargo.toml manifest
//!
//! ```cargo
//! [dependencies]
//! anyhow = "1.0.86"
//! reqwest = { version = "0.11", features = ["json", "rustls-tls"], default-features = false }
//! tokio = { version = "1.0", features = ["full"] }
//! serde_json = "1.0"
//! ```
//!
//! Note that serde is used by default with the `derive` feature.
//! You can still reimport it if you need additional features.

use anyhow::anyhow;
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Serialize, Debug)]
struct ReturnType {
    completion_ratio: Option<serde_json::Value>,
    model_ratio: Option<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
struct ApiResponse {
    data: Vec<KeyValue>,
}

#[derive(Deserialize, Debug)]
struct KeyValue {
    key: String,
    value: String,
}

/// Creates a channel for the model provider
async fn create_channel(
    client: &reqwest::Client,
    system_token: &str,
    base_url_cua_nguon: &str,
    token_cua_nguon: &str,
    ten_model_tu_nguon: &str,
    ten_model_tren_llm_ai_vn: &str,
) -> anyhow::Result<()> {
    let host = base_url_cua_nguon
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .split('/')
        .next()
        .unwrap_or(base_url_cua_nguon);

    let channel_name = format!(
        "{} {} -> {}",
        host, ten_model_tu_nguon, ten_model_tren_llm_ai_vn
    );

    let model_mapping = serde_json::json!({
      ten_model_tren_llm_ai_vn: ten_model_tu_nguon
    });

    let models = format!("{},{}", ten_model_tu_nguon, ten_model_tren_llm_ai_vn);

    let channel_body = serde_json::json!({
      "name": channel_name,
      "type": 50,
      "key": token_cua_nguon,
      "base_url": base_url_cua_nguon,
      "other": "",
      "model_mapping": model_mapping.to_string(),
      "system_prompt": "",
      "models": models,
      "groups": ["default"],
      "group": "default",
      "config": "{\"region\":\"\",\"sk\":\"\",\"ak\":\"\",\"user_id\":\"\",\"vertex_ai_project_id\":\"\",\"vertex_ai_adc\":\"\"}"
    });

    println!(
        "Creating channel with body: {}",
        serde_json::to_string_pretty(&channel_body)?
    );

    let channel_response = client
        .post("https://api.llm.ai.vn/api/channel/")
        .header("Authorization", system_token)
        .json(&channel_body)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to create channel: {}", e))?;

    let channel_status = channel_response.status();
    if !channel_status.is_success() {
        let error_text = channel_response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(anyhow!(
            "Channel creation failed with status: {} - {}",
            channel_status,
            error_text
        ));
    }

    let channel_result = channel_response
        .text()
        .await
        .map_err(|e| anyhow!("Failed to read channel response: {}", e))?;

    println!("Channel created successfully: {}", channel_result);

    Ok(())
}

/// Updates model price rates by fetching current ratios from the API
async fn update_model_price_rate(
    client: &reqwest::Client,
    system_token: &str,
    gia_1m_input_tokens: f64,
    gia_1m_output_tokens: f64,
    ten_model_tu_nguon: &str,
    ten_model_tren_llm_ai_vn: &str,
) -> anyhow::Result<(Option<serde_json::Value>, Option<serde_json::Value>)> {
    println!("Updating model price rates...");
    println!("Input price: ${} per 1M tokens", gia_1m_input_tokens);
    println!("Output price: ${} per 1M tokens", gia_1m_output_tokens);

    // Make GET request to the API to fetch current ratios
    let response = client
        .get("https://api.llm.ai.vn/api/option/")
        .header("Authorization", system_token)
        .send()
        .await
        .map_err(|e| anyhow!("Failed to make request: {}", e))?;

    if !response.status().is_success() {
        return Err(anyhow!(
            "API request failed with status: {}",
            response.status()
        ));
    }

    let api_response: ApiResponse = response
        .json()
        .await
        .map_err(|e| anyhow!("Failed to parse JSON response: {}", e))?;

    println!("Received {} items from API", api_response.data.len());

    let mut completion_ratio = None;
    let mut model_ratio = None;

    // Find CompletionRatio and ModelRatio keys
    for item in api_response.data {
        match item.key.as_str() {
            "CompletionRatio" => match serde_json::from_str::<serde_json::Value>(&item.value) {
                Ok(mut parsed_value) => {
                    println!("CompletionRatio found and parsed: {}", parsed_value);

                    parsed_value[ten_model_tu_nguon] =
                        (gia_1m_output_tokens / gia_1m_input_tokens).into();
                    parsed_value[ten_model_tren_llm_ai_vn] =
                        (gia_1m_output_tokens / gia_1m_input_tokens).into();

                    completion_ratio = Some(parsed_value);
                }
                Err(e) => {
                    println!("Failed to parse CompletionRatio JSON: {}", e);
                    println!("Raw value: {}", item.value);
                }
            },
            "ModelRatio" => match serde_json::from_str::<serde_json::Value>(&item.value) {
                Ok(mut parsed_value) => {
                    println!("ModelRatio found and parsed: {}", parsed_value);

                    parsed_value[ten_model_tu_nguon] = (gia_1m_input_tokens / 2.5f64).into();
                    parsed_value[ten_model_tren_llm_ai_vn] = (gia_1m_input_tokens / 2.5f64).into();

                    model_ratio = Some(parsed_value);
                }
                Err(e) => {
                    println!("Failed to parse ModelRatio JSON: {}", e);
                    println!("Raw value: {}", item.value);
                }
            },
            _ => {} // Ignore other keys
        }
    }

    if completion_ratio.is_none() {
        println!("CompletionRatio key not found in response");
    }

    if model_ratio.is_none() {
        println!("ModelRatio key not found in response");
    }

    // Update the ratios on the server if we have new values
    if let Some(ref model_rates) = model_ratio {
        println!("Updating ModelRatio on server...");
        let model_ratio_body = serde_json::json!({
          "key": "ModelRatio",
          "value": model_rates.to_string()
        });

        let model_response = client
            .put("https://api.llm.ai.vn/api/option/")
            .header("Authorization", system_token)
            .json(&model_ratio_body)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to update ModelRatio: {}", e))?;

        let model_status = model_response.status();
        if !model_status.is_success() {
            let error_text = model_response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow!(
                "ModelRatio update failed with status: {} - {}",
                model_status,
                error_text
            ));
        }
        println!("ModelRatio updated successfully");
    }

    if let Some(ref completion_rates) = completion_ratio {
        println!("Updating CompletionRatio on server...");
        let completion_ratio_body = serde_json::json!({
          "key": "CompletionRatio",
          "value": completion_rates.to_string()
        });

        let completion_response = client
            .put("https://api.llm.ai.vn/api/option/")
            .header("Authorization", system_token)
            .json(&completion_ratio_body)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to update CompletionRatio: {}", e))?;

        let completion_status = completion_response.status();
        if !completion_status.is_success() {
            let error_text = completion_response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(anyhow!(
                "CompletionRatio update failed with status: {} - {}",
                completion_status,
                error_text
            ));
        }
        println!("CompletionRatio updated successfully");
    }

    println!("Model price rate update completed");
    Ok((completion_ratio, model_ratio))
}

#[allow(dead_code)]
fn main(
    base_url_cua_nguon: String,
    token_cua_nguon: String,
    ten_model_tu_nguon: String,
    ten_model_tren_llm_ai_vn: String,
    gia_1m_input_tokens: f64,
    gia_1m_output_tokens: f64,
) -> anyhow::Result<ReturnType> {
    let system_token =
        env::var("SYSTEM_TOKEN").unwrap_or_else(|_| "e2535681c9dd4df19487484ed2ecd7b4".to_string());

    println!("System token: {}", system_token);
    println!("BaseURL của nguồn: {}", base_url_cua_nguon);
    println!("Token của nguồn: {}", token_cua_nguon);
    println!("Tên model từ nguồn: {}", ten_model_tu_nguon);
    println!("Tên model trên LLM AI VN: {}", ten_model_tren_llm_ai_vn);
    println!("Giá 1M input tokens ($): {}", gia_1m_input_tokens);
    println!("Giá 1M output tokens ($): {}", gia_1m_output_tokens);

    // Create tokio runtime for async operations
    let rt = tokio::runtime::Runtime::new()?;

    let (completion_ratio, model_ratio) = rt.block_on(async {
        let client = reqwest::Client::new();

        // Create a channel
        create_channel(
            &client,
            &system_token,
            &base_url_cua_nguon,
            &token_cua_nguon,
            &ten_model_tu_nguon,
            &ten_model_tren_llm_ai_vn,
        )
        .await?;

        // Update model price rates
        let (completion_ratio, model_ratio) = update_model_price_rate(
            &client,
            &system_token,
            gia_1m_input_tokens,
            gia_1m_output_tokens,
            &ten_model_tu_nguon,
            &ten_model_tren_llm_ai_vn,
        )
        .await?;

        Ok::<(Option<serde_json::Value>, Option<serde_json::Value>), anyhow::Error>((
            completion_ratio,
            model_ratio,
        ))
    })?;

    Ok(ReturnType {
        completion_ratio,
        model_ratio,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_main() {
        env::set_var("SYSTEM_TOKEN", "e2535681c9dd4df19487484ed2ecd7b4");

        let original_token = env::var("SYSTEM_TOKEN").ok();

        main(
            "https://api.example.com".to_string(),
            "test_token".to_string(),
            "script-model-source".to_string(),
            "script-model-llmaivn".to_string(),
            0.03,
            0.06,
        )
        .unwrap();

        // Restore original token if it existed
        if let Some(token) = original_token {
            env::set_var("SYSTEM_TOKEN", token);
        }
    }
}
