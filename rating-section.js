/**
 * Rating Section - Đánh giá dịch vụ cứu hộ
 * - Chưa có đánh giá: hiển thị form (sao + textarea + nút Gửi)
 * - Đã có đánh giá: hiển thị kết quả (sao + comment)
 */
(function () {
  const MAX_COMMENT_LEN = 250;
  const FILLED_STAR = '<svg class="star-icon star-filled" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  const OUTLINE_STAR = '<svg class="star-icon star-outline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

  let selectedStar = 0;
  let orderId = null;

  function renderStars(container, count, interactive) {
    if (!container) return;
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const filled = i <= count;
      if (interactive) {
        html += `<button type="button" class="star-btn" data-value="${i}" aria-label="${i} sao">${filled ? FILLED_STAR : OUTLINE_STAR}</button>`;
      } else {
        html += `<span class="star-static">${filled ? FILLED_STAR : OUTLINE_STAR}</span>`;
      }
    }
    container.innerHTML = html;
  }

  function updateCharCount() {
    const input = document.getElementById('ratingCommentInput');
    const counter = document.getElementById('ratingCharCount');
    if (input && counter) {
      const len = input.value.length;
      counter.textContent = `(${len}/${MAX_COMMENT_LEN})`;
    }
  }

  function getOrderData() {
    return window.currentOrderData || {};
  }

  window.RatingSection = {
    init(container) {
      if (!container) return Promise.resolve();
      const section = container.querySelector('#ratingSection');
      if (section) {
        this.bindEvents(container);
      }
      return Promise.resolve();
    },

    bindEvents(container) {
      const starsInput = container.querySelector('#ratingStarsInput');
      const commentInput = container.querySelector('#ratingCommentInput');
      const btnSubmit = container.querySelector('#btnSubmitRating');

      if (starsInput) {
        starsInput.addEventListener('click', (e) => {
          const btn = e.target.closest('.star-btn');
          if (btn) {
            selectedStar = parseInt(btn.dataset.value, 10);
            renderStars(starsInput, selectedStar, true);
          }
        });
      }

      if (commentInput) {
        commentInput.addEventListener('input', updateCharCount);
      }

      if (btnSubmit) {
        btnSubmit.addEventListener('click', () => this.submitRating());
      }
    },

    render(order) {
      const section = document.getElementById('ratingSection');
      if (!section) return;

      const hasRating = order.star != null && order.star > 0;
      orderId = order.id;

      const formWrap = section.querySelector('#ratingFormWrap');
      const displayWrap = section.querySelector('#ratingDisplayWrap');

      if (hasRating) {
        if (formWrap) formWrap.classList.add('hidden');
        if (displayWrap) {
          displayWrap.classList.remove('hidden');
          const starsDisplay = displayWrap.querySelector('#ratingStarsDisplay');
          const detailContent = displayWrap.querySelector('#ratingDetailContent');
          if (starsDisplay) renderStars(starsDisplay, Math.min(5, Math.max(0, order.star)), false);
          if (detailContent) detailContent.textContent = order.rateComment || '-';
        }
      } else {
        if (formWrap) {
          formWrap.classList.remove('hidden');
          selectedStar = 0;
          const starsInput = formWrap.querySelector('#ratingStarsInput');
          const commentInput = formWrap.querySelector('#ratingCommentInput');
          if (starsInput) renderStars(starsInput, 0, true);
          if (commentInput) {
            commentInput.value = '';
            commentInput.placeholder = 'Bạn có thể chia sẻ thêm trải nghiệm của mình';
          }
          updateCharCount();
        }
        if (displayWrap) displayWrap.classList.add('hidden');
      }
    },

    submitRating() {
      const commentInput = document.getElementById('ratingCommentInput');
      const comment = commentInput ? commentInput.value.trim() : '';
      if (selectedStar < 1) {
        alert('Vui lòng chọn số sao đánh giá.');
        return;
      }
      // TODO: Gọi API gửi đánh giá
      const order = getOrderData();
      if (window.submitRescueRating) {
        window.submitRescueRating({ orderId: order.id, star: selectedStar, rateComment: comment || null });
      } else {
        // Mock: cập nhật local và re-render
        const updated = { ...order, star: selectedStar, rateComment: comment || null };
        window.currentOrderData = updated;
        if (window.renderOrder) window.renderOrder(updated);
      }
    },
  };
})();
