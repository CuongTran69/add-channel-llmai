// --- Toast Notification System ---
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'toastSlideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// --- Console Log System ---
const logDiv = document.getElementById('console-log');

function log(message, type = 'normal') {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;

    entry.innerHTML = `
        <span class="log-timestamp">[${timestamp}]</span>
        <span>${message}</span>
    `;

    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
}

function clearLog() {
    logDiv.innerHTML = '';
    showToast('Log Cleared', 'Console log đã được xóa', 'info');
}

// --- LocalStorage Cache System ---
const CACHE_KEY = 'llm_channel_manager_cache';

function saveToCache() {
    const data = {
        systemToken: document.getElementById('systemToken').value,
        baseUrl: document.getElementById('baseUrl').value,
        sourceToken: document.getElementById('sourceToken').value,
        sourceModel: document.getElementById('sourceModel').value,
        targetModel: document.getElementById('targetModel').value,
        inputPrice: document.getElementById('inputPrice').value,
        outputPrice: document.getElementById('outputPrice').value,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    log('💾 Dữ liệu đã được lưu vào cache', 'info');
}

function loadFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const data = JSON.parse(cached);

            document.getElementById('systemToken').value = data.systemToken || '';
            document.getElementById('baseUrl').value = data.baseUrl || '';
            document.getElementById('sourceToken').value = data.sourceToken || '';
            document.getElementById('sourceModel').value = data.sourceModel || '';
            document.getElementById('targetModel').value = data.targetModel || '';
            document.getElementById('inputPrice').value = data.inputPrice || '';
            document.getElementById('outputPrice').value = data.outputPrice || '';

            log('📂 Dữ liệu đã được tải từ cache', 'info');
            showToast('Cache Loaded', 'Dữ liệu đã được khôi phục từ lần trước', 'info');
        }
    } catch (e) {
        log('⚠️ Không thể tải cache: ' + e.message, 'warn');
    }
}

function clearCache() {
    localStorage.removeItem(CACHE_KEY);
    log('🗑️ Cache đã được xóa', 'info');
    showToast('Cache Cleared', 'Dữ liệu cache đã được xóa', 'info');
}

// --- Theme Management ---
const THEME_KEY = 'llm_channel_manager_theme';

function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
}

function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
    log(`🎨 Theme changed to ${theme} mode`, 'info');
}

function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    const themeName = newTheme === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️';
    showToast('Theme Changed', `Đã chuyển sang ${themeName}`, 'info');
}

// Auto-save on input change and clear errors
function setupAutoSave() {
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('change', saveToCache);

        // Clear error when user starts typing
        input.addEventListener('input', function () {
            if (this.classList.contains('error')) {
                clearFieldError(this.id);
            }
        });
    });
}

// --- Validation ---
function clearFieldError(fieldId) {
    const input = document.getElementById(fieldId);
    const errorSpan = document.getElementById(`${fieldId}-error`);

    if (input) {
        input.classList.remove('error');
    }
    if (errorSpan) {
        errorSpan.classList.remove('show');
        errorSpan.textContent = '';
    }
}

function showFieldError(fieldId, message) {
    const input = document.getElementById(fieldId);
    const errorSpan = document.getElementById(`${fieldId}-error`);

    if (input) {
        input.classList.add('error');
    }
    if (errorSpan) {
        errorSpan.textContent = message;
        errorSpan.classList.add('show');
    }

    log(`❌ ${message}`, 'error');
}

function clearAllErrors() {
    const fields = ['systemToken', 'baseUrl', 'sourceToken', 'sourceModel', 'targetModel', 'inputPrice', 'outputPrice'];
    fields.forEach(field => clearFieldError(field));
}

function validateInputs() {
    clearAllErrors();

    const systemToken = document.getElementById('systemToken').value.trim();
    const baseUrl = document.getElementById('baseUrl').value.trim();
    const sourceToken = document.getElementById('sourceToken').value.trim();
    const sourceModel = document.getElementById('sourceModel').value.trim();
    const targetModel = document.getElementById('targetModel').value.trim();
    const inputPrice = parseFloat(document.getElementById('inputPrice').value);
    const outputPrice = parseFloat(document.getElementById('outputPrice').value);

    let hasError = false;

    // Validate System Token
    if (!systemToken) {
        showFieldError('systemToken', 'System Token không được để trống');
        hasError = true;
    }

    // Validate Base URL
    if (!baseUrl) {
        showFieldError('baseUrl', 'Base URL không được để trống');
        hasError = true;
    } else if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        showFieldError('baseUrl', 'Base URL phải bắt đầu với http:// hoặc https://');
        hasError = true;
    }

    // Validate Source Token
    if (!sourceToken) {
        showFieldError('sourceToken', 'Source Token không được để trống');
        hasError = true;
    }

    // Validate Source Model
    if (!sourceModel) {
        showFieldError('sourceModel', 'Source Model không được để trống');
        hasError = true;
    }

    // Validate Target Model
    if (!targetModel) {
        showFieldError('targetModel', 'Target Model không được để trống');
        hasError = true;
    }

    // Validate Input Price
    if (!document.getElementById('inputPrice').value) {
        showFieldError('inputPrice', 'Giá Input không được để trống');
        hasError = true;
    } else if (isNaN(inputPrice) || inputPrice <= 0) {
        showFieldError('inputPrice', 'Giá Input phải là số dương');
        hasError = true;
    }

    // Validate Output Price
    if (!document.getElementById('outputPrice').value) {
        showFieldError('outputPrice', 'Giá Output không được để trống');
        hasError = true;
    } else if (isNaN(outputPrice) || outputPrice <= 0) {
        showFieldError('outputPrice', 'Giá Output phải là số dương');
        hasError = true;
    }

    if (hasError) {
        showToast('Lỗi Validation', 'Vui lòng kiểm tra và điền đầy đủ thông tin', 'error');
        return false;
    }

    return {
        systemToken,
        baseUrl,
        sourceToken,
        sourceModel,
        targetModel,
        inputPrice,
        outputPrice
    };
}

// --- API Functions ---
async function createChannel(systemToken, baseUrl, token, sourceModel, targetModel) {
    log('📡 Bắt đầu tạo channel...', 'info');
    showToast('Đang xử lý', 'Đang tạo channel mới...', 'info');

    let host = baseUrl.replace(/^https?:\/\//, '').split('/')[0];
    if (!host) host = baseUrl;

    const channelName = `${host} ${sourceModel} -> ${targetModel}`;
    const modelMapping = {};
    modelMapping[targetModel] = sourceModel;
    const models = `${sourceModel},${targetModel}`;

    const channelBody = {
        name: channelName,
        type: 50,
        key: token,
        base_url: baseUrl,
        other: "",
        model_mapping: JSON.stringify(modelMapping),
        system_prompt: "",
        models: models,
        groups: ["default"],
        group: "default",
        config: JSON.stringify({
            region: "", sk: "", ak: "", user_id: "",
            vertex_ai_project_id: "", vertex_ai_adc: ""
        })
    };

    log(`📝 Channel name: ${channelName}`, 'info');
    log(`📦 Request body: ${JSON.stringify(channelBody, null, 2)}`);

    const response = await fetch("https://api.llm.ai.vn/api/channel/", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': systemToken
        },
        body: JSON.stringify(channelBody)
    });

    if (!response.ok) {
        const errText = await response.text();
        log(`❌ Create Channel Failed (${response.status}): ${errText}`, 'error');
        throw new Error(`Create Channel Failed (${response.status}): ${errText}`);
    }

    const result = await response.text();
    log(`✅ Channel created successfully: ${result}`, 'normal');
    showToast('Thành công!', `Channel "${channelName}" đã được tạo`, 'success');
}

async function updatePrice(systemToken, inputPrice, outputPrice, sourceModel, targetModel) {
    log('💰 Bắt đầu cập nhật giá...', 'info');
    showToast('Đang xử lý', 'Đang cập nhật giá model...', 'info');

    log('🔍 Fetching current API options...', 'info');

    const response = await fetch("https://api.llm.ai.vn/api/option/", {
        method: 'GET',
        headers: { 'Authorization': systemToken }
    });

    if (!response.ok) {
        log(`❌ Get Options Failed: ${response.status}`, 'error');
        throw new Error(`Get Options Failed: ${response.status}`);
    }

    const apiResponse = await response.json();
    const data = apiResponse.data || [];

    log(`📊 Fetched ${data.length} option items`, 'info');

    let completionRatio = null;
    let modelRatio = null;

    for (const item of data) {
        if (item.key === "CompletionRatio") {
            try {
                let parsed = JSON.parse(item.value);
                const ratio = outputPrice / inputPrice;
                parsed[sourceModel] = ratio;
                parsed[targetModel] = ratio;
                completionRatio = parsed;
                log(`📈 CompletionRatio calculated: ${ratio.toFixed(4)}`, 'info');
            } catch (e) {
                log(`⚠️ Error parsing CompletionRatio: ${e.message}`, 'warn');
            }
        }
        else if (item.key === "ModelRatio") {
            try {
                let parsed = JSON.parse(item.value);
                const ratio = inputPrice / 2.5;
                parsed[sourceModel] = ratio;
                parsed[targetModel] = ratio;
                modelRatio = parsed;
                log(`📈 ModelRatio calculated: ${ratio.toFixed(4)}`, 'info');
            } catch (e) {
                log(`⚠️ Error parsing ModelRatio: ${e.message}`, 'warn');
            }
        }
    }

    if (modelRatio) {
        log('🔄 Updating ModelRatio...', 'info');
        await updateOption(systemToken, "ModelRatio", modelRatio);
    } else {
        log('⚠️ ModelRatio key not found, skipping update', 'warn');
        showToast('Cảnh báo', 'ModelRatio không tìm thấy', 'warning');
    }

    if (completionRatio) {
        log('🔄 Updating CompletionRatio...', 'info');
        await updateOption(systemToken, "CompletionRatio", completionRatio);
    } else {
        log('⚠️ CompletionRatio key not found, skipping update', 'warn');
        showToast('Cảnh báo', 'CompletionRatio không tìm thấy', 'warning');
    }

    showToast('Thành công!', 'Giá đã được cập nhật', 'success');
}

async function updateOption(systemToken, key, jsonValue) {
    const body = {
        key: key,
        value: JSON.stringify(jsonValue)
    };

    log(`📤 Sending update for ${key}...`);

    const res = await fetch("https://api.llm.ai.vn/api/option/", {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': systemToken
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const txt = await res.text();
        log(`❌ Update ${key} Failed: ${txt}`, 'error');
        throw new Error(`Update ${key} Failed: ${txt}`);
    }

    log(`✅ ${key} updated successfully`, 'normal');
}

// --- Main Script ---
async function runScript() {
    const btn = document.getElementById('btnRun');
    const btnText = document.getElementById('btnText');

    clearLog();
    log('🚀 Khởi động process...', 'info');

    const inputs = validateInputs();
    if (!inputs) {
        showToast('Lỗi', 'Vui lòng kiểm tra lại thông tin nhập', 'error');
        return;
    }

    // Save to cache before running
    saveToCache();

    btn.disabled = true;
    btn.classList.add('loading');
    btnText.textContent = '⏳ Đang xử lý...';

    try {
        log('═══════════════════════════════════════', 'info');
        log('STEP 1: CREATE CHANNEL', 'info');
        log('═══════════════════════════════════════', 'info');

        await createChannel(
            inputs.systemToken,
            inputs.baseUrl,
            inputs.sourceToken,
            inputs.sourceModel,
            inputs.targetModel
        );

        log('═══════════════════════════════════════', 'info');
        log('STEP 2: UPDATE PRICES', 'info');
        log('═══════════════════════════════════════', 'info');

        await updatePrice(
            inputs.systemToken,
            inputs.inputPrice,
            inputs.outputPrice,
            inputs.sourceModel,
            inputs.targetModel
        );

        log('═══════════════════════════════════════', 'normal');
        log('✅ TẤT CẢ TÁC VỤ HOÀN THÀNH XUẤT SẮC!', 'normal');
        log('═══════════════════════════════════════', 'normal');

        showToast('Hoàn thành! 🎉', 'Tất cả tác vụ đã được thực hiện thành công', 'success');

    } catch (err) {
        log('═══════════════════════════════════════', 'error');
        log(`❌ LỖI XẢY RA: ${err.message}`, 'error');
        log('═══════════════════════════════════════', 'error');

        showToast('Lỗi!', err.message, 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.classList.remove('loading');
        btnText.textContent = '🚀 Tạo Channel & Update Giá';
    }
}

// --- Initialize on page load ---
document.addEventListener('DOMContentLoaded', function () {
    // Initialize theme
    const savedTheme = getTheme();
    setTheme(savedTheme);

    log('🎯 System ready. Chào mừng bạn đến với LLM Channel Manager!', 'info');

    // Load cached data
    loadFromCache();

    // Setup auto-save
    setupAutoSave();

    // Theme toggle button
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // Add clear cache button handler
    const clearCacheBtn = document.getElementById('btnClearCache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', function () {
            if (confirm('Bạn có chắc muốn xóa cache?')) {
                clearCache();
                // Clear all inputs
                document.querySelectorAll('input').forEach(input => {
                    if (input.id !== 'systemToken' && input.id !== 'baseUrl') {
                        input.value = '';
                    }
                });
            }
        });
    }
});
