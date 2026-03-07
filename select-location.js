/**
 * Màn hình chọn vị trí - Tìm kiếm địa chỉ, chọn trên bản đồ, xác nhận
 * Dữ liệu truyền qua URL params: lat, lng, address
 * Khi xác nhận: lưu vào sessionStorage và quay về index.html
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  const lat = parseFloat(p.get('lat')) || 21.0278;
  const lng = parseFloat(p.get('lng')) || 105.8342;
  const address = decodeURIComponent(p.get('address') || 'Hà Nội, Việt Nam');
  return { lat, lng, address };
}

let map, marker;
let selectedLocation = { lat: 0, lng: 0, address: '' };
let searchTimeout = null;

function initMap() {
  const { lat, lng, address } = getUrlParams();
  selectedLocation = { lat, lng, address };

  map = L.map('map').setView([lat, lng], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(map);

  marker = L.marker([lat, lng], { draggable: true }).addTo(map);

  marker.on('dragend', function () {
    const pos = marker.getLatLng();
    selectedLocation.lat = pos.lat;
    selectedLocation.lng = pos.lng;
    reverseGeocode(pos.lat, pos.lng);
  });

  map.on('click', function (e) {
    marker.setLatLng(e.latlng);
    selectedLocation.lat = e.latlng.lat;
    selectedLocation.lng = e.latlng.lng;
    reverseGeocode(e.latlng.lat, e.latlng.lng);
  });

  updateSelectedUI();
}

async function searchAddress(query) {
  if (!query || query.length < 3) return [];
  const url = `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=vn`;
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'vi', 'User-Agent': 'VETC-Rescue-WebView/1.0' },
  });
  const data = await res.json();
  return data.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    address: item.display_name,
  }));
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_URL}/reverse?lat=${lat}&lon=${lng}&format=json`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'vi', 'User-Agent': 'VETC-Rescue-WebView/1.0' },
    });
    const data = await res.json();
    selectedLocation.address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    selectedLocation.address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
  updateSelectedUI();
}

function updateSelectedUI() {
  const addrEl = document.getElementById('selectedAddress');
  const coordsEl = document.getElementById('selectedCoords');
  if (addrEl) addrEl.textContent = selectedLocation.address;
  if (coordsEl) coordsEl.textContent = `${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`;
}

function showSearchResults(results) {
  const container = document.getElementById('searchResults');
  if (!container) return;
  if (!results || results.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = results
    .map(
      (r, i) =>
        `<div class="search-result-item" data-lat="${r.lat}" data-lng="${r.lng}" data-address="${r.address.replace(/"/g, '&quot;')}">${r.address}</div>`
    )
    .join('');

  container.querySelectorAll('.search-result-item').forEach((el) => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.dataset.lat);
      const lng = parseFloat(el.dataset.lng);
      const address = el.dataset.address;
      selectedLocation = { lat, lng, address };
      marker.setLatLng([lat, lng]);
      map.setView([lat, lng], 16);
      updateSelectedUI();
      document.getElementById('searchInput').value = address;
      container.classList.add('hidden');
    });
  });
}

function confirmAndGoBack() {
  const data = {
    incidentLocation: selectedLocation.address,
    incidentLocationLat: selectedLocation.lat,
    incidentLocationLong: selectedLocation.lng,
  };
  if (window.opener && typeof window.opener.updateRescueLocation === 'function') {
    window.opener.updateRescueLocation(data);
    window.close();
  } else {
    sessionStorage.setItem('locationUpdate', JSON.stringify(data));
    window.location.href = 'index.html';
  }
}

function init() {
  initMap();

  document.getElementById('btnBack').addEventListener('click', () => {
    if (window.opener) {
      window.close();
    } else {
      window.history.back();
      if (window.history.length <= 1) window.location.href = 'index.html';
    }
  });

  document.getElementById('btnConfirm').addEventListener('click', confirmAndGoBack);

  const searchInput = document.getElementById('searchInput');
  const btnClear = document.getElementById('btnClearSearch');

  searchInput.value = getUrlParams().address;
  searchInput.addEventListener('input', () => {
    btnClear.classList.toggle('visible', searchInput.value.length > 0);
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (q.length < 3) {
      document.getElementById('searchResults').classList.add('hidden');
      return;
    }
    searchTimeout = setTimeout(async () => {
      const results = await searchAddress(q);
      showSearchResults(results);
    }, 400);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 3 && document.getElementById('searchResults').children.length)
      document.getElementById('searchResults').classList.remove('hidden');
  });

  btnClear.addEventListener('click', () => {
    searchInput.value = '';
    btnClear.classList.remove('visible');
    document.getElementById('searchResults').classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-bar-relative'))
      document.getElementById('searchResults').classList.add('hidden');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
