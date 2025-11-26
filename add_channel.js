/**
 * Add dependencies:
 * This script runs natively in Node.js v18+.
 * If using an older version, install 'node-fetch': npm install node-fetch
 */

const https = require('https');

// Helper to simulate generic logging consistent with the Rust code
const log = (msg) => console.log(msg);

// Helper for native fetch if not available (shim for older node versions)
// In Node 18+, global.fetch is available by default.
const fetchRequest = global.fetch || (async (url, options) => {
    const { default: fetch } = await import('node-fetch');
    return fetch(url, options);
});

/**
 * Creates a channel for the model provider
 */
async function createChannel(
    systemToken,
    baseUrlCuaNguon,
    tokenCuaNguon,
    tenModelTuNguon,
    tenModelTrenLlmAiVn
) {
    // Logic: extract host similar to Rust's trim_start_matches and split
    let host = baseUrlCuaNguon
        .replace(/^https?:\/\//, '') // trim http/https
        .split('/')[0]; // split by / and take first

    if (!host) host = baseUrlCuaNguon;

    const channelName = `${host} ${tenModelTuNguon} -> ${tenModelTrenLlmAiVn}`;

    const modelMapping = {};
    modelMapping[tenModelTrenLlmAiVn] = tenModelTuNguon;

    const models = `${tenModelTuNguon},${tenModelTrenLlmAiVn}`;

    const channelBody = {
        name: channelName,
        type: 50,
        key: tokenCuaNguon,
        base_url: baseUrlCuaNguon,
        other: "",
        model_mapping: JSON.stringify(modelMapping),
        system_prompt: "",
        models: models,
        groups: ["default"],
        group: "default",
        config: JSON.stringify({
            region: "",
            sk: "",
            ak: "",
            user_id: "",
            vertex_ai_project_id: "",
            vertex_ai_adc: ""
        })
    };

    log(`Creating channel with body: ${JSON.stringify(channelBody, null, 2)}`);

    try {
        const response = await fetchRequest("https://api.llm.ai.vn/api/channel/", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': systemToken
            },
            body: JSON.stringify(channelBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Channel creation failed with status: ${response.status} - ${errorText}`);
        }

        const channelResult = await response.text();
        log(`Channel created successfully: ${channelResult}`);

    } catch (error) {
        throw new Error(`Failed to create channel: ${error.message}`);
    }
}

/**
 * Updates model price rates by fetching current ratios from the API
 */
async function updateModelPriceRate(
    systemToken,
    gia1mInputTokens,
    gia1mOutputTokens,
    tenModelTuNguon,
    tenModelTrenLlmAiVn
) {
    log("Updating model price rates...");
    log(`Input price: $${gia1mInputTokens} per 1M tokens`);
    log(`Output price: $${gia1mOutputTokens} per 1M tokens`);

    let completionRatio = null;
    let modelRatio = null;

    try {
        // GET request to fetch options
        const response = await fetchRequest("https://api.llm.ai.vn/api/option/", {
            method: 'GET',
            headers: {
                'Authorization': systemToken
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed with status: ${response.status}`);
        }

        const apiResponse = await response.json();
        const data = apiResponse.data || [];

        log(`Received ${data.length} items from API`);

        // Iterate through data to find ratios
        for (const item of data) {
            if (item.key === "CompletionRatio") {
                try {
                    let parsedValue = JSON.parse(item.value);
                    log(`CompletionRatio found and parsed: ${JSON.stringify(parsedValue)}`);

                    // Logic: output / input
                    const ratio = gia1mOutputTokens / gia1mInputTokens;
                    parsedValue[tenModelTuNguon] = ratio;
                    parsedValue[tenModelTrenLlmAiVn] = ratio;

                    completionRatio = parsedValue;
                } catch (e) {
                    log(`Failed to parse CompletionRatio JSON: ${e.message}`);
                    log(`Raw value: ${item.value}`);
                }
            } else if (item.key === "ModelRatio") {
                try {
                    let parsedValue = JSON.parse(item.value);
                    log(`ModelRatio found and parsed: ${JSON.stringify(parsedValue)}`);

                    // Logic: input / 2.5
                    const ratio = gia1mInputTokens / 2.5;
                    parsedValue[tenModelTuNguon] = ratio;
                    parsedValue[tenModelTrenLlmAiVn] = ratio;

                    modelRatio = parsedValue;
                } catch (e) {
                    log(`Failed to parse ModelRatio JSON: ${e.message}`);
                    log(`Raw value: ${item.value}`);
                }
            }
        }

        if (!completionRatio) log("CompletionRatio key not found in response");
        if (!modelRatio) log("ModelRatio key not found in response");

        // Update ModelRatio on server
        if (modelRatio) {
            log("Updating ModelRatio on server...");
            const modelRatioBody = {
                key: "ModelRatio",
                value: JSON.stringify(modelRatio)
            };

            const modelResponse = await fetchRequest("https://api.llm.ai.vn/api/option/", {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': systemToken
                },
                body: JSON.stringify(modelRatioBody)
            });

            if (!modelResponse.ok) {
                const text = await modelResponse.text();
                throw new Error(`ModelRatio update failed with status: ${modelResponse.status} - ${text}`);
            }
            log("ModelRatio updated successfully");
        }

        // Update CompletionRatio on server
        if (completionRatio) {
            log("Updating CompletionRatio on server...");
            const completionRatioBody = {
                key: "CompletionRatio",
                value: JSON.stringify(completionRatio)
            };

            const compResponse = await fetchRequest("https://api.llm.ai.vn/api/option/", {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': systemToken
                },
                body: JSON.stringify(completionRatioBody)
            });

            if (!compResponse.ok) {
                const text = await compResponse.text();
                throw new Error(`CompletionRatio update failed with status: ${compResponse.status} - ${text}`);
            }
            log("CompletionRatio updated successfully");
        }

        log("Model price rate update completed");
        return { completion_ratio: completionRatio, model_ratio: modelRatio };

    } catch (error) {
        throw new Error(`Failed to update model prices: ${error.message}`);
    }
}

/**
 * Main function orchestrator
 */
async function main(
    baseUrlCuaNguon,
    tokenCuaNguon,
    tenModelTuNguon,
    tenModelTrenLlmAiVn,
    gia1mInputTokens,
    gia1mOutputTokens
) {
    const systemToken = process.env.SYSTEM_TOKEN || "e2535681c9dd4df19487484ed2ecd7b4";

    log(`System token: ${systemToken}`);
    log(`BaseURL của nguồn: ${baseUrlCuaNguon}`);
    log(`Token của nguồn: ${tokenCuaNguon}`);
    log(`Tên model từ nguồn: ${tenModelTuNguon}`);
    log(`Tên model trên LLM AI VN: ${tenModelTrenLlmAiVn}`);
    log(`Giá 1M input tokens ($): ${gia1mInputTokens}`);
    log(`Giá 1M output tokens ($): ${gia1mOutputTokens}`);

    try {
        // Create Channel
        await createChannel(
            systemToken,
            baseUrlCuaNguon,
            tokenCuaNguon,
            tenModelTuNguon,
            tenModelTrenLlmAiVn
        );

        // Update Prices
        const result = await updateModelPriceRate(
            systemToken,
            gia1mInputTokens,
            gia1mOutputTokens,
            tenModelTuNguon,
            tenModelTrenLlmAiVn
        );

        return result;

    } catch (error) {
        console.error("Error occurred:", error.message);
        process.exit(1);
    }
}

// --- Execution Entry Point (Equivalent to the Rust Test/Main) ---

if (require.main === module) {
    // Example usage arguments
    // In a real CLI, you might parse process.argv here
    const args = {
        baseUrl: "https://api.example.com",
        token: "test_token",
        sourceModel: "script-model-source",
        targetModel: "script-model-llmaivn",
        inputPrice: 0.03,
        outputPrice: 0.06
    };

    // If running directly, execute main with test values (similar to Rust #[test])
    main(
        args.baseUrl,
        args.token,
        args.sourceModel,
        args.targetModel,
        args.inputPrice,
        args.outputPrice
    ).then((result) => {
        log("Process finished successfully.");
        // console.log("Final Return:", result);
    });
}

module.exports = { main };