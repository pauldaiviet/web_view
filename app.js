/**
 * WebView - Chi tiết đơn hàng cứu hộ
 * Luồng: [MOCK] API token success => API lấy data từ mock JSON => Render
 *
 * TODO: Chuyển sang API thật - response trả về cùng cấu trúc { data: { status, states, ... } }
 *       Chỉ cần gọi fetchOrder() → renderOrder(data), UI tự cập nhật theo response.
 *       Xem .cursor/rules/api-migration.mdc
 */

const CONFIG = {
  TOKEN_API: 'https://your-api.com/auth/token',
  ORDER_API: 'https://your-api.com/orders/{id}',
  UPDATE_ORDER_API: 'https://your-api.com/orders/{id}/update',
  TOKEN_METHOD: 'POST',
  ORDER_METHOD: 'GET',
  MOCK_MODE: true,
  MOCK_DATA_PATH: 'mock-data/COMPLETED_NO_RATING.json',
};

const MOCK_OPTIONS = [
  { file: 'INITIAL.json', label: 'INITIAL - Khởi tạo' },
  { file: 'CONFIRMED.json', label: 'CONFIRMED - Đã xác nhận' },
  { file: 'ASSIGNING.json', label: 'ASSIGNING - Điều phối' },
  { file: 'IN_PROGRESS.json', label: 'IN_PROGRESS - Đang thực hiện' },
  { file: 'IN_PROGRESS_DRIVER_ON_THE_WAY.json', label: 'IN_PROGRESS - Tài xế đang đến' },
  { file: 'IN_PROGRESS_RESCUE_IN_PROGRESS.json', label: 'IN_PROGRESS - Đang thực hiện cứu hộ' },
  { file: 'IN_PROGRESS_RESCUE_MOVE_TO_TOWING_POINT.json', label: 'IN_PROGRESS - Đang kéo xe về gara' },
  { file: 'IN_PROGRESS_RESCUE_COMPLETED_BY_DRIVER.json', label: 'IN_PROGRESS - Hoàn thành bởi tài xế' },
  { file: 'COMPLETED.json', label: 'COMPLETED - Hoàn thành' },
  { file: 'COMPLETED_NO_RATING.json', label: 'COMPLETED - Hoàn thành (chưa đánh giá)' },
  { file: 'COMPLETED_WITH_RATING.json', label: 'COMPLETED - Hoàn thành (đã đánh giá)' },
  { file: 'CANCELLED.json', label: 'CANCELLED - Đã hủy' },
  { file: 'FAILED.json', label: 'FAILED - Thất bại' },
];

const DOM = {
  loading: null,
  content: null,
  errorState: null,
  errorMessage: null,
  actionButtons: null,
  btnUpdate: null,
  btnCallDriver: null,
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

/**
 * Lấy thông tin progress steps (4 bước cố định)
 * - Step 0: Chờ cứu hộ (INITIAL, CONFIRMED, ASSIGNING)
 * - Step 1: Tài xế đang đến (IN_PROGRESS + DRIVER_ON_THE_WAY)
 * - Step 2: Đang cứu hộ (IN_PROGRESS + RESCUE_IN_PROGRESS, RESCUE_MOVE_TO_TOWING_POINT)
 * - Step 3: Hoàn thành hoặc Huỷ (COMPLETED, RESCUE_COMPLETED_BY_DRIVER, CANCELLED, FAILED)
 */
function getProgressInfo(order) {
  const status = (order.status || '').toUpperCase();
  const states = Array.isArray(order.states) ? order.states : [];
  const stepLabels = ['Chờ cứu hộ', 'Tài xế đang đến', 'Đang cứu hộ', 'Hoàn thành cứu hộ'];

  // INITIAL, CONFIRMED, ASSIGNING → Chờ cứu hộ (step 0)
  if (['INITIAL', 'CONFIRMED', 'ASSIGNING'].includes(status)) {
    return { type: 'progress', activeIndex: 0, stepLabels };
  }

  // IN_PROGRESS → dựa theo states
  if (status === 'IN_PROGRESS') {
    let activeIndex = 0;
    const hasDriverOnTheWay = states.some((s) => (s || '').toUpperCase() === 'DRIVER_ON_THE_WAY');
    const hasRescueInProgress = states.some((s) => (s || '').toUpperCase() === 'RESCUE_IN_PROGRESS');
    const hasMoveToTowing = states.some((s) => (s || '').toUpperCase() === 'RESCUE_MOVE_TO_TOWING_POINT');
    const hasCompletedByDriver = states.some((s) => (s || '').toUpperCase() === 'RESCUE_COMPLETED_BY_DRIVER');
    if (hasCompletedByDriver) activeIndex = 3;
    else if (hasRescueInProgress || hasMoveToTowing) activeIndex = 2;
    else if (hasDriverOnTheWay) activeIndex = 1;
    return { type: 'progress', activeIndex, stepLabels };
  }

  // COMPLETED → Hoàn thành (step 3)
  if (status === 'COMPLETED') {
    return { type: 'progress', activeIndex: 3, stepLabels };
  }

  // FAILED, CANCELLED → Huỷ (step 3)
  if (status === 'FAILED' || status === 'CANCELLED') {
    const labels = [...stepLabels];
    labels[3] = 'Đã huỷ';
    return { type: 'progress', activeIndex: 3, stepLabels: labels };
  }

  return { type: 'progress', activeIndex: 0, stepLabels };
}

/**
 * Lấy lý do hủy/thất bại dựa theo status và states (CANCELLED / FAILED)
 */
function getCancelFailedReason(order) {
  const status = (order.status || '').toUpperCase();
  const states = Array.isArray(order.states) ? order.states : [];
  const cancelledMap = {
    CANCELLED_BY_CUSTOMER: 'Khách hủy',
    CANCELLED_BY_DRIVER: 'Tài xế hủy',
    CANCELLED_BY_PROVIDER: 'Đối tác hủy',
  };
  const failedMap = {
    FAILED_NO_PROVIDER: 'Không tìm đối tác',
    FAILED_NO_DRIVER: 'Không tìm thấy tài xế',
    FAILED_SYSTEM_ERROR: 'Lỗi hệ thống',
  };
  if (status === 'CANCELLED') {
    const state = states.find((s) => cancelledMap[(s || '').toUpperCase()]);
    return state ? cancelledMap[state.toUpperCase()] : 'Đã hủy';
  }
  if (status === 'FAILED') {
    const state = states.find((s) => failedMap[(s || '').toUpperCase()]);
    return state ? failedMap[state.toUpperCase()] : 'Lỗi hệ thống';
  }
  return null;
}

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
  const progressInfo = getProgressInfo(order);
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

  // RESCUE_MOVE_TO_TOWING_POINT, RESCUE_COMPLETED_BY_DRIVER, COMPLETED → "Kéo xe về" + towDestination
  const states = Array.isArray(order.states) ? order.states : [];
  const status = (order.status || '').toUpperCase();
  const isTowMode = status === 'COMPLETED'
    || (status === 'IN_PROGRESS' && states.some((s) => ['RESCUE_MOVE_TO_TOWING_POINT', 'RESCUE_COMPLETED_BY_DRIVER'].includes((s || '').toUpperCase())));
  const locationLabel = isTowMode ? 'Kéo xe về' : 'Vị trí cứu hộ';
  const locationAddress = isTowMode ? (order.towDestination || '-') : incidentLoc;
  setText('locationLabel', locationLabel);
  setText('incidentLocation', locationAddress);

  // Thông tin tài xế - hiện từ "Tài xế đang đến" trở đi (activeIndex >= 1)
  const driverSection = document.getElementById('driverInfoSection');
  const showDriverInfo = progressInfo.type === 'progress' && progressInfo.activeIndex >= 1;
  if (driverSection) {
    driverSection.classList.toggle('hidden', !showDriverInfo);
    if (showDriverInfo) {
      setText('rescueStaffName', order.rescueStaffName || '-');
      setText('rescueStaffPhone', order.rescueStaffPhone || '-');
      setText('rescueStaffPlate', order.rescueStaffPlate || '-');
      const phoneLink = document.getElementById('rescueStaffPhoneLink');
      if (phoneLink) {
        const phone = order.rescueStaffPhone || '';
        phoneLink.href = phone ? `tel:${phone}` : '#';
        phoneLink.dataset.phone = phone;
      }
      const plateWrap = document.getElementById('driverPlateWrap');
      if (plateWrap) plateWrap.style.display = order.rescueStaffPlate ? '' : 'none';
    }
  }

  const vehicleInput = document.getElementById('vehicleStatusDesc');
  if (vehicleInput && vehicleInput.tagName === 'TEXTAREA') {
    vehicleInput.value = order.vehicleStatusDescription || '';
    vehicleInput.placeholder = 'VD: Lốp trước bên phải bị nổ, không có lốp dự phòng...';
  } else {
    setText('vehicleStatusDesc', vehicleDesc);
  }

  const mapFrame = document.getElementById('mapFrame');
  if (mapFrame) {
    const mapLat = isTowMode && order.towDestinationLatitude != null ? order.towDestinationLatitude : lat;
    const mapLng = isTowMode && order.towDestinationLongitude != null ? order.towDestinationLongitude : lng;
    mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLng - 0.02},${mapLat - 0.02},${mapLng + 0.02},${mapLat + 0.02}&layer=mapnik&marker=${mapLat},${mapLng}`;
  }

  const progressStepsEl = document.getElementById('progressSteps');
  const progressStateErrorEl = document.getElementById('progressStateError');
  const progressStateMessageEl = document.getElementById('progressStateErrorMessage');
  if (progressStepsEl) progressStepsEl.classList.remove('hidden');

  const steps = document.querySelectorAll('.progress-step');
  const isEndState = ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status);
  const isCancelled = ['FAILED', 'CANCELLED'].includes(status);
  if (progressStepsEl) progressStepsEl.classList.toggle('step-cancelled', isCancelled && progressInfo.activeIndex === 3);
  steps.forEach((el, i) => {
    const labelEl = el.querySelector('.step-label');
    if (labelEl && progressInfo.stepLabels && progressInfo.stepLabels[i]) {
      labelEl.textContent = progressInfo.stepLabels[i];
    }
    el.classList.toggle('done', i < progressInfo.activeIndex || (isEndState && i === progressInfo.activeIndex));
    el.classList.toggle('active', i === progressInfo.activeIndex);
  });

  // Section lý do hủy/thất bại - hiện khi CANCELLED hoặc FAILED
  const cancelFailedReason = getCancelFailedReason(order);
  if (progressStateErrorEl && progressStateMessageEl) {
    if (cancelFailedReason) {
      progressStateErrorEl.classList.remove('hidden');
      progressStateErrorEl.classList.toggle('state-cancelled', status === 'CANCELLED');
      progressStateMessageEl.textContent = `Lý do hủy yêu cầu: ${cancelFailedReason}`;
    } else {
      progressStateErrorEl.classList.add('hidden');
    }
  }

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

  // vehicleIncidentContainer chỉ hiện khi INITIAL, CONFIRMED, ASSIGNING
  const vehicleContainer = document.getElementById('vehicleIncidentContainer');
  if (vehicleContainer) {
    vehicleContainer.classList.toggle('hidden', !['INITIAL', 'CONFIRMED', 'ASSIGNING'].includes(status));
  }

  // btn-edit-location chỉ hiện khi cho phép edit (API trả allowEditLocation, hoặc derive từ status)
  const allowEditLocation = order.allowEditLocation !== undefined
    ? Boolean(order.allowEditLocation)
    : ['INITIAL', 'CONFIRMED', 'ASSIGNING'].includes(status);
  const btnEditLocation = document.getElementById('btnEditLocation') || document.querySelector('.btn-edit-location');
  if (btnEditLocation) btnEditLocation.classList.toggle('hidden', !allowEditLocation);

  // Hiển thị nút theo trạng thái: INITIAL/CONFIRMED/ASSIGNING → Cập nhật; IN_PROGRESS → Gọi tài xế; Gọi CSKH luôn hiện
  const showBtnUpdate = ['INITIAL', 'CONFIRMED', 'ASSIGNING'].includes(status);
  const showBtnCallDriver = status === 'IN_PROGRESS';
  if (DOM.btnUpdate) DOM.btnUpdate.classList.toggle('hidden', !showBtnUpdate);
  if (DOM.btnCallDriver) {
    DOM.btnCallDriver.classList.toggle('hidden', !showBtnCallDriver);
    const phone = order.rescueStaffPhone || '';
    DOM.btnCallDriver.dataset.phone = phone;
  }

  // Rating section: chỉ hiện khi COMPLETED
  const ratingContainer = document.getElementById('ratingContainer');
  if (ratingContainer) {
    const showRating = status === 'COMPLETED';
    ratingContainer.classList.toggle('hidden', !showRating);
    if (showRating && window.RatingSection && window.RatingSection.render) {
      window.RatingSection.render(order);
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
  DOM.btnCallDriver = document.getElementById('btnCallDriver');
  DOM.btnCallCS = document.getElementById('btnCallCS');

  window.AppConfig = CONFIG;
  window.fetchToken = fetchToken;

  if (DOM.btnCallDriver) {
    DOM.btnCallDriver.addEventListener('click', () => {
      const phone = DOM.btnCallDriver.dataset.phone || '';
      if (phone) window.location.href = `tel:${phone}`;
    });
  }

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

  const ratingContainer = document.getElementById('ratingContainer');
  if (ratingContainer && window.RatingSection && window.RatingSection.init) {
    await window.RatingSection.init(ratingContainer);
  }

  const btnEditLocation = document.getElementById('btnEditLocation') || document.querySelector('.btn-edit-location');
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

  window.renderOrder = renderOrder;
  await loadOrder();

  initFloatingMockSelector();
}

/**
 * Khởi tạo floating button chọn mock data (chỉ khi MOCK_MODE)
 */
function initFloatingMockSelector() {
  const wrapper = document.getElementById('floatingMockSelector');
  const btn = document.getElementById('floatingMockBtn');
  const panel = document.getElementById('floatingMockPanel');
  const optionsEl = document.getElementById('floatingMockOptions');
  if (!wrapper || !btn || !panel || !optionsEl || !CONFIG.MOCK_MODE) return;

  wrapper.classList.remove('hidden');
  const currentFile = CONFIG.MOCK_DATA_PATH;
  optionsEl.innerHTML = MOCK_OPTIONS.map(
    (opt) => {
      const path = `mock-data/${opt.file}`;
      return `<button type="button" class="floating-mock-option ${path === currentFile ? 'active' : ''}" data-file="${path}">${opt.label}</button>`;
    }
  ).join('');

  btn.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) panel.classList.add('hidden');
  });

  optionsEl.addEventListener('click', async (e) => {
    const opt = e.target.closest('.floating-mock-option');
    if (!opt) return;
    const file = opt.dataset.file;
    if (!file) return;
    panel.classList.add('hidden');
    try {
      const res = await fetch(file);
      const json = await res.json();
      if (!res.ok) throw new Error('Không tải được dữ liệu');
      const orderData = json.data || json;
      renderOrder(orderData);
      optionsEl.querySelectorAll('.floating-mock-option').forEach((o) => o.classList.remove('active'));
      opt.classList.add('active');
    } catch (err) {
      console.error('Load mock error:', err);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
