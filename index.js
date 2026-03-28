// ── TABS ──
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
});

// ── TOAST ──
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

// ── SCANNER ──
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewImg = document.getElementById('previewImg');
const resultBox = document.getElementById('resultBox');
const copyResultBtn = document.getElementById('copyResultBtn');
const clearBtn = document.getElementById('clearBtn');
const openLinkBtn = document.getElementById('openLinkBtn');
const scanStatus = document.getElementById('scanStatus');
const scanStatusText = document.getElementById('scanStatusText');
let lastResult = '';

function setStatus(state, text) {
    scanStatus.className = 'scan-status ' + state;
    scanStatusText.textContent = text;
}

function processFile(file) {
    if (!file || !file.type.startsWith('image/')) {
        setStatus('error', 'Invalid file — images only');
        return;
    }
    const objectUrl = URL.createObjectURL(file);
    previewImg.src = objectUrl;
    dropZone.classList.add('has-image');
    resultBox.className = 'result-box loading';
    resultBox.innerHTML = '<span class="spinner"></span>&nbsp; Scanning…';
    setStatus('', 'Scanning QR code…');
    copyResultBtn.disabled = true;
    openLinkBtn.style.display = 'none';

    const img = new Image();
    img.onload = function () {
        const canvas = document.createElement('canvas');
        // Scale up for better detection on small images
        const scale = Math.max(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = img.naturalWidth * scale;
        canvas.height = img.naturalHeight * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        });
        URL.revokeObjectURL(objectUrl);
        if (code && code.data) {
            lastResult = code.data;
            resultBox.className = 'result-box success';
            resultBox.textContent = code.data;
            copyResultBtn.disabled = false;
            setStatus('ready', 'QR decoded successfully ✓');
            if (/^https?:\/\//i.test(code.data)) {
                openLinkBtn.style.display = 'flex';
                openLinkBtn.onclick = () => window.open(code.data, '_blank');
            }
        } else {
            resultBox.className = 'result-box error';
            resultBox.textContent = 'Could not decode — try a clearer or higher-resolution image.';
            setStatus('error', 'Decode failed');
        }
    };
    img.onerror = function () {
        resultBox.className = 'result-box error';
        resultBox.textContent = 'Failed to load image.';
        setStatus('error', 'Load error');
    };
    img.src = objectUrl;
}

fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault(); dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
});
copyResultBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(lastResult).then(() => showToast('Copied!'));
});
clearBtn.addEventListener('click', () => {
    fileInput.value = '';
    previewImg.src = '';
    dropZone.classList.remove('has-image');
    resultBox.className = 'result-box empty';
    resultBox.textContent = 'Upload a QR code image to see the decoded content here.';
    copyResultBtn.disabled = true;
    openLinkBtn.style.display = 'none';
    setStatus('', 'Waiting for image…');
    lastResult = '';
});

// ── GENERATOR ──
const typeGrid = document.getElementById('typeGrid');
const genFields = document.getElementById('genFields');
const generateBtn = document.getElementById('generateBtn');
const qrOutput = document.getElementById('qr-output');
const qrPlaceholder = document.getElementById('qrPlaceholder');
const qrWrap = document.getElementById('qrWrap');
const genActions = document.getElementById('genActions');
const downloadBtn = document.getElementById('downloadBtn');
const copyQrBtn = document.getElementById('copyQrBtn');
let currentType = 'url';
let currentQRData = '';

const fieldTemplates = {
    url: `<div class="field-group"><label>Website URL</label><input id="f_url" type="url" placeholder="https://example.com"/></div>`,
    text: `<div class="field-group"><label>Plain Text</label><textarea id="f_text" placeholder="Enter any text…"></textarea></div>`,
    phone: `<div class="field-group"><label>Phone Number</label><input id="f_phone" type="tel" placeholder="+91 98765 43210"/></div>`,
    sms: `<div class="field-group"><label>Phone Number</label><input id="f_sms_phone" type="tel" placeholder="+91 98765 43210"/></div>
             <div class="field-group"><label>Message (optional)</label><textarea id="f_sms_msg" placeholder="Hello!"></textarea></div>`,
    email: `<div class="field-group"><label>Email Address</label><input id="f_email" type="email" placeholder="hello@example.com"/></div>
             <div class="field-group"><label>Subject (optional)</label><input id="f_subject" placeholder="Subject line"/></div>`,
    wifi: `<div class="field-group"><label>Network Name (SSID)</label><input id="f_ssid" placeholder="MyWiFi"/></div>
             <div class="field-group"><label>Password</label><input id="f_pass" type="password" placeholder="••••••••"/></div>
             <div class="field-group"><label>Security</label><select id="f_enc"><option>WPA</option><option>WEP</option><option value="nopass">None</option></select></div>`,
    contact: `<div class="field-group"><label>Full Name</label><input id="f_name" placeholder="John Doe"/></div>
             <div class="field-group"><label>Phone</label><input id="f_cphone" type="tel" placeholder="+91 98765 43210"/></div>
             <div class="field-group"><label>Email</label><input id="f_cemail" type="email" placeholder="john@example.com"/></div>`,
    location: `<div class="field-group"><label>Latitude</label><input id="f_lat" type="number" step="any" placeholder="28.6139"/></div>
             <div class="field-group"><label>Longitude</label><input id="f_lng" type="number" step="any" placeholder="77.2090"/></div>`,
};

function buildData() {
    const g = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
    switch (currentType) {
        case 'url': return g('f_url') || null;
        case 'text': return g('f_text') || null;
        case 'phone': return g('f_phone') ? 'tel:' + g('f_phone') : null;
        case 'sms': return g('f_sms_phone') ? 'smsto:' + g('f_sms_phone') + ':' + g('f_sms_msg') : null;
        case 'email': return g('f_email') ? 'mailto:' + g('f_email') + '?subject=' + encodeURIComponent(g('f_subject')) : null;
        case 'wifi': return g('f_ssid') ? 'WIFI:T:' + g('f_enc') + ';S:' + g('f_ssid') + ';P:' + g('f_pass') + ';;' : null;
        case 'contact': return g('f_name') ? 'BEGIN:VCARD\nVERSION:3.0\nFN:' + g('f_name') + '\nTEL:' + g('f_cphone') + '\nEMAIL:' + g('f_cemail') + '\nEND:VCARD' : null;
        case 'location': return (g('f_lat') && g('f_lng')) ? 'geo:' + g('f_lat') + ',' + g('f_lng') : null;
        default: return null;
    }
}

function renderFields(type) { genFields.innerHTML = fieldTemplates[type] || ''; }

typeGrid.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        typeGrid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        renderFields(currentType);
        qrOutput.innerHTML = '';
        qrPlaceholder.style.display = '';
        qrWrap.classList.remove('has-code');
        genActions.style.display = 'none';
    });
});

renderFields('url');

generateBtn.addEventListener('click', () => {
    const data = buildData();
    if (!data) { showToast('Please fill in the required field'); return; }
    currentQRData = data;
    qrOutput.innerHTML = '';
    qrPlaceholder.style.display = 'none';
    new QRCode(qrOutput, {
        text: data, width: 200, height: 200,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
    qrWrap.classList.add('has-code');
    genActions.style.display = 'flex';
    showToast('QR Code generated!');
});

downloadBtn.addEventListener('click', () => {
    const canvas = qrOutput.querySelector('canvas');
    const img = qrOutput.querySelector('img');
    if (canvas) {
        const a = document.createElement('a'); a.download = 'qr-code.png'; a.href = canvas.toDataURL(); a.click();
    } else if (img) {
        const a = document.createElement('a'); a.download = 'qr-code.png'; a.href = img.src; a.click();
    }
});

copyQrBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentQRData).then(() => showToast('Data copied!'));
});