(async function newOrderNotification() {
  const OVERLAY_ID = 'newOrderOverlay';
  if (document.getElementById(OVERLAY_ID)) return;

  const cookie = document.cookie.match(/(?:^|; )nf_jwt=([^;]+)/);
  if (!cookie) return;
  const token = decodeURIComponent(cookie[1]);

  let res;
  try {
    res = await fetch('/.netlify/functions/admin-list-orders', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
  } catch (_) { return; }
  if (!res.ok) return;

  const data = await res.json();
  const orders = Array.isArray(data.orders) ? data.orders : [];
  const lastVisit = localStorage.getItem('adminLastVisit');
  const now = new Date().toISOString();

  const newOrders = orders.filter(function (o) {
    if (!o.placedAt) return false;
    if (lastVisit && o.placedAt <= lastVisit) return false;
    return true;
  });

  localStorage.setItem('adminLastVisit', now);

  if (newOrders.length === 0) return;

  var style = document.createElement('style');
  style.textContent =
    '.new-order-overlay{position:fixed;inset:0;background:rgba(10,5,20,.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:10000;animation:fadeInOverlay .25s ease}' +
    '@keyframes fadeInOverlay{from{opacity:0}to{opacity:1}}' +
    '.new-order-modal{background:linear-gradient(160deg,rgba(55,32,85,.97) 0%,rgba(30,18,50,.99) 100%);border:1px solid rgba(192,192,210,.2);border-radius:20px;padding:32px 28px 24px;max-width:420px;width:90%;box-shadow:0 12px 40px rgba(0,0,0,.6);text-align:center;animation:slideUpModal .3s ease}' +
    '@keyframes slideUpModal{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}' +
    '.new-order-modal .bell{font-size:40px;margin-bottom:12px;display:block}' +
    '.new-order-modal h2{margin:0 0 6px;font-size:22px;color:#e8e3f0}' +
    '.new-order-modal .count-badge{display:inline-block;background:linear-gradient(135deg,#6b48a6 0%,#9b6fd4 100%);color:#fff;font-weight:800;font-size:28px;width:52px;height:52px;line-height:52px;border-radius:50%;margin:10px 0 8px;box-shadow:0 4px 14px rgba(107,72,166,.5)}' +
    '.new-order-modal .detail{color:#c0bcd0;font-size:14px;margin:6px 0 0;line-height:1.5}' +
    '.new-order-modal .order-names{color:#d4c0f0;font-weight:600;font-size:13px;margin:12px 0 0;max-height:100px;overflow-y:auto;line-height:1.7}' +
    '.new-order-modal .modal-actions{margin-top:20px;display:flex;gap:10px;justify-content:center}' +
    '.new-order-modal .modal-actions button{min-width:110px;padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;border:none;transition:background .2s}' +
    '.new-order-modal .modal-actions .btn-primary{background:linear-gradient(135deg,#6b48a6,#9b6fd4);color:#fff}' +
    '.new-order-modal .modal-actions .btn-primary:hover{background:linear-gradient(135deg,#7b58b6,#ab7fe4)}' +
    '.new-order-modal .modal-actions .btn-secondary{background:rgba(192,192,210,.15);color:#c0bcd0;border:1px solid rgba(192,192,210,.25)}' +
    '.new-order-modal .modal-actions .btn-secondary:hover{color:#e8e3f0;border-color:#c0bcd0}';
  document.head.appendChild(style);

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  var nameLines = newOrders
    .sort(function (a, b) { return (b.placedAt || '').localeCompare(a.placedAt || ''); })
    .slice(0, 8)
    .map(function (o) {
      var name = o.customerName || o.email || 'Unknown';
      var total = parseFloat(String(o.total || '0')) || 0;
      return esc(name) + ' &mdash; $' + total.toFixed(2);
    });
  if (newOrders.length > 8) nameLines.push('and ' + (newOrders.length - 8) + ' more…');

  var overlay = document.createElement('div');
  overlay.className = 'new-order-overlay';
  overlay.id = OVERLAY_ID;
  overlay.innerHTML =
    '<div class="new-order-modal">' +
      '<span class="bell" aria-hidden="true">&#128276;</span>' +
      '<h2>' + (newOrders.length === 1 ? 'New Order!' : 'New Orders!') + '</h2>' +
      '<div class="count-badge">' + newOrders.length + '</div>' +
      '<p class="detail">' + (newOrders.length === 1 ? 'new order since your last visit' : 'new orders since your last visit') + '</p>' +
      '<div class="order-names">' + nameLines.join('<br>') + '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn-primary" id="newOrderViewBtn">View orders</button>' +
        '<button type="button" class="btn-secondary" id="newOrderDismissBtn">Dismiss</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  function dismiss() { overlay.remove(); }

  document.getElementById('newOrderDismissBtn').addEventListener('click', dismiss);
  document.getElementById('newOrderViewBtn').addEventListener('click', function () {
    dismiss();
    if (window.location.pathname === '/admin.html') {
      var filter = document.getElementById('filterStatus');
      if (filter) { filter.value = ''; }
      if (typeof window.renderOrders === 'function') window.renderOrders();
    } else {
      window.location.href = '/admin.html';
    }
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) dismiss();
  });
})();
