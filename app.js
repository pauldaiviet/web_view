/**
 * WebView - Chi tiết đơn hàng cứu hộ
 * Luồng: [MOCK] API token success => API lấy data từ data.json => Render
 */

const CONFIG = {
  TOKEN_API: 'https://your-api.com/auth/token',
  ORDER_API: 'https://your-api.com/orders/{id}',
  UPDATE_ORDER_API: 'https://your-api.com/orders/{id}/update',
  TOKEN_METHOD: 'POST',
  ORDER_METHOD: 'GET',
  MOCK_MODE: true,
  MOCK_DATA_PATH: 'data.json',
};

const DOM = {
  loading: null,
  content: null,
  errorState: null,
  errorMessage: null,
  actionButtons: null,
  btnUpdate: null,
  btnCallCS: null,
};

let currentOrderData = null;

/** Cập nhật vị trí lên UI (gọi từ select-location popup) */
window.updateRescueLocation = function (data) {
  if (!data || !currentOrderData) return;
  currentOrderData = { ...currentOrderData, ...data };
  window.currentOrderData = currentOrderData;
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText('incidentLocation', data.incidentLocation || '-');
  const mapFrame = document.getElementById('mapFrame');
  if (mapFrame && data.incidentLocationLat != null && data.incidentLocationLong != null) {
    const lat = data.incidentLocationLat;
    const lng = data.incidentLocationLong;
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.02},${lng + 0.02},${lat + 0.02}&layer=mapnik&marker=${lat},${lng}`;
  }
};

/**
 * [MOCK] Gọi API lấy token - luôn success
 */
async function fetchToken() {
  if (CONFIG.MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 300)); // Giả lập delay
    return 'mock_token_' + Date.now();
  }
  const res = await fetch(CONFIG.TOKEN_API, {
    method: CONFIG.TOKEN_METHOD,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '1', ref: '1' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không lấy được token');
  return data.token || data.accessToken || data.access_token || data.data?.token;
}

/**
 * [MOCK] Gọi API lấy thông tin đơn cứu hộ - lấy từ data.json
 */
async function fetchOrder() {
  if (CONFIG.MOCK_MODE) {
    await new Promise((r) => setTimeout(r, 400));
    const res = await fetch(CONFIG.MOCK_DATA_PATH);
    const json = await res.json();
    if (!res.ok) throw new Error('Không tải được dữ liệu');
    return json.data || json;
  }
  const token = await fetchToken();
  const res = await fetch(CONFIG.ORDER_API, {
    method: CONFIG.ORDER_METHOD,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Không lấy được thông tin đơn hàng');
  return data.data || data.order || data;
}

/**
 * Định dạng số tiền VND
 */
function formatPrice(value) {
  if (value == null) return '0đ';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Định dạng ngày giờ
 */
function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${time} - ${date}`;
  } catch {
    return String(isoStr);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Mô tả dịch vụ theo id/name (dùng khi API không trả description) */
function getServiceDescription(s) {
  const map = {
    2: 'Hỗ trợ khởi động xe khi ắc quy hết điện giữa đường nhanh',
    3: 'Cung cấp xăng, dầu, nước làm mát khẩn cấp khi xe hết nhiên liệu',
    'Kích bình': 'Hỗ trợ khởi động xe khi ắc quy hết điện giữa đường nhanh',
    'Kích bình ắc quy': 'Hỗ trợ khởi động xe khi ắc quy hết điện giữa đường nhanh',
    'Sự cố về lốp': 'Vá/ thay thế lốp khẩn cấp',
    'Kéo xe': 'Hỗ trợ kéo xe về gara gần nhất',
    'Cung cấp nhiên liệu khẩn cấp (xăng, dầu, nước làm mát)': 'Cung cấp xăng, dầu, nước làm mát khẩn cấp khi xe hết nhiên liệu',
  };
  return map[s.id] ?? map[s.name] ?? 'Dịch vụ cứu hộ đường bộ';
}

/** Map status sang label và step index (0-3) */
const STATUS_MAP = {
  PENDING: { label: 'Chờ cứu hộ', step: 0 },
  WAITING: { label: 'Chờ cứu hộ', step: 0 },
  DRIVER_COMING: { label: 'Tài xế đang đến', step: 1 },
  IN_PROGRESS: { label: 'Đang cứu hộ', step: 2 },
  COMPLETED: { label: 'Hoàn thành cứu hộ', step: 3 },
};

/**
 * Render đơn cứu hộ lên giao diện
 */
function renderOrder(order) {
  currentOrderData = { ...order };
  window.currentOrderData = currentOrderData;

  const hasPackage = order.packagePurchasedId != null;
  const packageLabel = hasPackage ? 'Có gói' : 'Đơn lẻ';
  const plate = order.plate || '-';
  const orderCode = order.rescueOrderCode || order.id || '-';
  const reportedTime = formatDateTime(order.reportedTime);
  const incidentLoc = order.incidentLocation || order.rescueStationAddress || '-';
  const vehicleDesc = order.vehicleStatusDescription || 'VD: Lốp trước bên phải bị nổ, không có lốp dự phòng...';
  const services = Array.isArray(order.services) ? order.services : [];
  const statusKey = (order.status || '').toUpperCase();
  const statusInfo = STATUS_MAP[statusKey] || STATUS_MAP.PENDING;
  const lat = order.incidentLocationLat ?? order.rescueStationLat ?? 21.018;
  const lng = order.incidentLocationLong ?? order.rescueStationLong ?? 105.815;

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  setText('packageTag', packageLabel);
  setText('rescueTitle', 'Yêu cầu cứu hộ');
  setText('orderCodeDate', `${orderCode} • ${reportedTime}`);
  setText('plateTag', plate);
  setText('incidentLocation', incidentLoc);

  const vehicleInput = document.getElementById('vehicleStatusDesc');
  if (vehicleInput && vehicleInput.tagName === 'TEXTAREA') {
    vehicleInput.value = order.vehicleStatusDescription || '';
    vehicleInput.placeholder = 'VD: Lốp trước bên phải bị nổ, không có lốp dự phòng...';
  } else {
    setText('vehicleStatusDesc', vehicleDesc);
  }

  const mapFrame = document.getElementById('mapFrame');
  if (mapFrame) {
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.02},${lat - 0.02},${lng + 0.02},${lat + 0.02}&layer=mapnik&marker=${lat},${lng}`;
  }

  const steps = document.querySelectorAll('.progress-step');
  steps.forEach((el, i) => {
    el.classList.toggle('active', i <= statusInfo.step);
    el.classList.toggle('done', i < statusInfo.step);
  });

  const servicesEl = document.getElementById('servicesList');
  if (servicesEl) {
    if (services.length === 0) {
      servicesEl.innerHTML = '<p class="services-empty">Chưa chọn dịch vụ</p>';
    } else {
      servicesEl.innerHTML = services
        .map((s) => {
          const name = s.name || String(s);
          const desc = s.description ?? getServiceDescription(s);
          return `<div class="service-card">
            <div class="service-card-name">${escapeHtml(name)}</div>
            <div class="service-card-desc">${escapeHtml(desc)}</div>
          </div>`;
        })
        .join('');
    }
  }

  if (DOM.loading) DOM.loading.classList.add('hidden');
  if (DOM.content) DOM.content.classList.remove('hidden');
  if (DOM.actionButtons) DOM.actionButtons.classList.remove('hidden');
}

/**
 * Hiển thị lỗi (dùng khi không redirect)
 */
function showError(message) {
  DOM.loading.classList.add('hidden');
  DOM.content.classList.add('hidden');
  DOM.errorState.classList.remove('hidden');
  DOM.errorMessage.textContent = message || 'Đã xảy ra lỗi. Vui lòng thử lại sau.';
}

/**
 * Chuyển sang trang "Đơn hàng không tồn tại"
 * Gọi khi bất kỳ API nào lỗi (token, order) hoặc thiếu ref
 */
function redirectOrderNotFound() {
  window.location.href = 'order-not-found.html';
}

/**
 * Luồng chính: load đơn cứu hộ
 */
async function loadOrder() {
  try {
    const token = await fetchToken();
    if (!token) throw new Error('Không nhận được token từ API');

    let orderData = await fetchOrder();
    if (!orderData) throw new Error('Không có dữ liệu đơn hàng');

    const locationUpdate = sessionStorage.getItem('locationUpdate');
    if (locationUpdate) {
      try {
        const update = JSON.parse(locationUpdate);
        orderData = { ...orderData, ...update };
        sessionStorage.removeItem('locationUpdate');
      } catch (_) {}
    }

    renderOrder(orderData);
  } catch (err) {
    console.error('Load order error:', err);
    redirectOrderNotFound();
  }
}

/**
 * Khởi tạo DOM references và event listeners
 */
async function init() {
  DOM.loading = document.getElementById('loading');
  DOM.content = document.getElementById('content');
  DOM.errorState = document.getElementById('errorState');
  DOM.errorMessage = document.getElementById('errorMessage');
  DOM.actionButtons = document.getElementById('actionButtons');
  DOM.btnUpdate = document.getElementById('btnUpdate');
  DOM.btnCallCS = document.getElementById('btnCallCS');

  window.AppConfig = CONFIG;
  window.fetchToken = fetchToken;

  if (DOM.btnCallCS) {
    DOM.btnCallCS.addEventListener('click', () => {
      window.location.href = 'tel:1900xxxx';
    });
  }


  const container = document.getElementById('vehicleIncidentContainer');
  if (container) {
    try {
      const res = await fetch('vehicle-incident-section.html');
      container.innerHTML = await res.text();
      if (window.VehicleIncidentEdit && window.VehicleIncidentEdit.init) {
        window.VehicleIncidentEdit.init();
      }
    } catch (e) {
      console.error('Load vehicle-incident-section:', e);
    }
  }

  const btnEditLocation = document.querySelector('.btn-edit-location');
  const drawer = document.getElementById('locationDrawer');
  const drawerOverlay = document.getElementById('locationDrawerOverlay');
  const drawerIframe = document.getElementById('locationDrawerIframe');

  function openLocationDrawer() {
    const lat = currentOrderData?.incidentLocationLat ?? currentOrderData?.rescueStationLat ?? 21.018;
    const lng = currentOrderData?.incidentLocationLong ?? currentOrderData?.rescueStationLong ?? 105.815;
    const address = currentOrderData?.incidentLocation ?? currentOrderData?.rescueStationAddress ?? 'Hà Nội, Việt Nam';
    const url = `select-location.html?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}`;
    drawerIframe.src = url;
    drawer?.classList.add('open');
    drawerOverlay?.classList.add('open');
  }

  function closeLocationDrawer() {
    drawer?.classList.remove('open');
    drawerOverlay?.classList.remove('open');
  }

  if (btnEditLocation) {
    btnEditLocation.addEventListener('click', openLocationDrawer);
  }

  drawerOverlay?.addEventListener('click', closeLocationDrawer);

  window.addEventListener('message', (e) => {
    if (e.data?.type === 'locationUpdate' && e.data?.data) {
      window.updateRescueLocation(e.data.data);
      closeLocationDrawer();
      drawerIframe.src = 'about:blank';
    } else if (e.data?.type === 'locationDrawerClose') {
      closeLocationDrawer();
    }
  });

  await loadOrder();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
