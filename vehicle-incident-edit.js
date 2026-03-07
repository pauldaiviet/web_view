/**
 * Module xử lý mô tả tình trạng xe + hình ảnh sự cố
 * Gắn event, upload ảnh, gọi API cập nhật
 */

(function () {
  const MAX_IMAGES = 4;
  let selectedImages = [];
  let imageObjectUrls = [];

  function getConfig() {
    return window.AppConfig || {};
  }

  function getCurrentOrder() {
    return window.currentOrderData || null;
  }

  function setCurrentOrder(data) {
    if (window.currentOrderData) window.currentOrderData = { ...window.currentOrderData, ...data };
  }

  async function fetchToken() {
    return window.fetchToken ? window.fetchToken() : null;
  }

  function updateImageUI() {
    const imageCountEl = document.getElementById('imageCount');
    const imagePlaceholder = document.getElementById('imagePlaceholder');
    const imageThumbnails = document.getElementById('imageThumbnails');

    imageObjectUrls.forEach((u) => URL.revokeObjectURL(u));
    imageObjectUrls = [];

    if (imageCountEl) imageCountEl.textContent = `${selectedImages.length}/${MAX_IMAGES}`;
    if (imagePlaceholder) imagePlaceholder.style.display = selectedImages.length >= MAX_IMAGES ? 'none' : 'flex';
    if (imageThumbnails) {
      imageThumbnails.innerHTML = selectedImages
        .map((file, i) => {
          const url = URL.createObjectURL(file);
          imageObjectUrls.push(url);
          return `<div class="thumb" data-index="${i}">
          <img src="${url}" alt="Ảnh ${i + 1}" />
          <span class="thumb-remove" role="button" tabindex="0">×</span>
        </div>`;
        })
        .join('');
      imageThumbnails.querySelectorAll('.thumb-remove').forEach((btn, i) => {
        btn.addEventListener('click', () => removeImage(i));
      });
    }
  }

  function removeImage(index) {
    if (selectedImages[index]) {
      selectedImages.splice(index, 1);
      updateImageUI();
    }
  }

  async function updateOrderRequest() {
    const order = getCurrentOrder();
    if (!order) {
      alert('Không có dữ liệu đơn hàng');
      return;
    }

    const config = getConfig();
    const orderId = order.id ?? order.orderId;
    const lat = order.incidentLocationLat ?? order.rescueStationLat;
    const lng = order.incidentLocationLong ?? order.rescueStationLong;
    const address = order.incidentLocation ?? order.rescueStationAddress ?? '';
    const descEl = document.getElementById('vehicleStatusDesc');
    const description = descEl?.value?.trim() ?? '';

    const formData = new FormData();
    formData.append('lat', lat ?? '');
    formData.append('long', lng ?? '');
    formData.append('address', address);
    formData.append('description', description);
    selectedImages.forEach((file) => formData.append('images', file));

    const btnUpdate = document.getElementById('btnUpdate');
    try {
      if (btnUpdate) {
        btnUpdate.disabled = true;
        btnUpdate.textContent = 'Đang cập nhật...';
      }

      let url = (config.UPDATE_ORDER_API || '').replace('{id}', orderId ?? '');
      let options = { method: 'POST', body: formData };

      if (config.MOCK_MODE) {
        await new Promise((r) => setTimeout(r, 800));
        console.log('MOCK update:', { lat, lng, address, description, imagesCount: selectedImages.length });
        alert('Cập nhật yêu cầu thành công!');
        return;
      }

      const token = await fetchToken();
      if (token) options.headers = { Authorization: `Bearer ${token}` };

      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Cập nhật thất bại');
      }

      alert('Cập nhật yêu cầu thành công!');
      setCurrentOrder(data.data || {});
    } catch (err) {
      console.error('Update error:', err);
      alert(err.message || 'Không thể cập nhật. Vui lòng thử lại.');
    } finally {
      if (btnUpdate) {
        btnUpdate.disabled = false;
        btnUpdate.textContent = 'Cập nhật yêu cầu';
      }
    }
  }

  function init() {
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
      imageInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
        const remaining = MAX_IMAGES - selectedImages.length;
        selectedImages.push(...files.slice(0, remaining));
        updateImageUI();
        e.target.value = '';
      });
    }

    const btnUpdate = document.getElementById('btnUpdate');
    if (btnUpdate) {
      btnUpdate.addEventListener('click', updateOrderRequest);
    }

    updateImageUI();
  }

  window.VehicleIncidentEdit = { init };
})();
