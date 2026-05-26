(function () {
  var POLL_MS = 60000;
  var bell, badge, dropdown, list;

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'style' && typeof attrs[k] === 'object') {
        Object.assign(e.style, attrs[k]);
      } else if (k.startsWith('on')) {
        e.addEventListener(k.slice(2), attrs[k]);
      } else {
        e.setAttribute(k, attrs[k]);
      }
    });
    (children || []).forEach(function (c) {
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    });
    return e;
  }

  function buildBell() {
    var wrap = el('div', { id: 'notifBellWrap', style: { position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '12px' } });

    bell = el('button', {
      id: 'notifBellBtn',
      'aria-label': 'Notifications',
      title: 'Notifications',
      style: {
        background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
        fontSize: '22px', lineHeight: '1', padding: '4px 6px', color: '#c0bcd0', transition: 'color 0.2s'
      },
      onmouseenter: function () { bell.style.color = '#e8e3f0'; },
      onmouseleave: function () { bell.style.color = '#c0bcd0'; },
      onclick: function (e) {
        e.stopPropagation();
        var vis = dropdown.style.display === 'none';
        dropdown.style.display = vis ? 'block' : 'none';
        if (vis) loadNotifications();
      }
    }, ['\u{1F514}']);

    badge = el('span', {
      id: 'notifBadge',
      style: {
        display: 'none', position: 'absolute', top: '0', right: '2px',
        background: '#e74c3c', color: '#fff', fontSize: '11px', fontWeight: '700',
        borderRadius: '50%', minWidth: '18px', height: '18px', lineHeight: '18px',
        textAlign: 'center', padding: '0 4px', pointerEvents: 'none'
      }
    });
    bell.appendChild(badge);

    dropdown = el('div', {
      id: 'notifDropdown',
      style: {
        display: 'none', position: 'absolute', top: '100%', right: '0', zIndex: '9999',
        width: '360px', maxHeight: '440px', overflowY: 'auto',
        background: 'linear-gradient(180deg, #2a1745, #1a0f2e)', border: '1px solid rgba(192,192,210,0.25)',
        borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: '8px'
      }
    });

    var header = el('div', {
      style: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid rgba(192,192,210,0.15)'
      }
    }, [
      el('strong', { style: { color: '#e8e3f0', fontSize: '14px' } }, ['Notifications']),
      el('button', {
        style: {
          background: 'transparent', border: 'none', color: '#b8e0c2', cursor: 'pointer',
          fontSize: '12px', fontWeight: '600'
        },
        onclick: function () { markAllRead(); }
      }, ['Mark all read'])
    ]);
    dropdown.appendChild(header);

    list = el('div', { id: 'notifList' });
    dropdown.appendChild(list);

    wrap.appendChild(bell);
    wrap.appendChild(dropdown);

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) dropdown.style.display = 'none';
    });

    return wrap;
  }

  function renderItem(n) {
    var icons = { order: '\u{1F4E6}', signup: '\u{1F464}', message: '\u{1F4AC}' };
    var ago = timeAgo(n.created_at || n.createdAt);
    var row = el('div', {
      style: {
        display: 'flex', gap: '10px', padding: '12px 16px', cursor: 'pointer',
        borderBottom: '1px solid rgba(192,192,210,0.1)',
        background: n.is_read || n.isRead ? 'transparent' : 'rgba(107,72,166,0.15)',
        transition: 'background 0.15s'
      },
      onmouseenter: function () { row.style.background = 'rgba(107,72,166,0.25)'; },
      onmouseleave: function () { row.style.background = (n.is_read || n.isRead) ? 'transparent' : 'rgba(107,72,166,0.15)'; },
      onclick: function () {
        if (!(n.is_read || n.isRead)) markRead(n.id);
        if (n.type === 'order') window.location.href = '/admin.html';
        else if (n.type === 'message') window.location.href = '/admin.html#messages';
        else if (n.type === 'signup') window.location.href = '/admin.html';
      }
    }, [
      el('span', { style: { fontSize: '20px', flexShrink: '0' } }, [icons[n.type] || '\u{1F514}']),
      el('div', { style: { flex: '1', minWidth: '0' } }, [
        el('div', { style: { fontSize: '13px', fontWeight: (n.is_read || n.isRead) ? '400' : '600', color: '#e8e3f0' } }, [n.title || 'Notification']),
        el('div', { style: { fontSize: '12px', color: '#b8b3c8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [n.body || '']),
        el('div', { style: { fontSize: '11px', color: '#8a85a0', marginTop: '4px' } }, [ago])
      ])
    ]);
    return row;
  }

  function timeAgo(ts) {
    if (!ts) return '';
    var diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return Math.floor(diff / 86400) + 'd ago';
  }

  var _cache = [];
  function loadNotifications() {
    fetch('/.netlify/functions/admin-notifications')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        _cache = data;
        render(data);
      })
      .catch(function () {});
  }

  function render(data) {
    list.innerHTML = '';
    if (!data.length) {
      list.appendChild(el('div', { style: { padding: '24px 16px', textAlign: 'center', color: '#8a85a0', fontSize: '13px' } }, ['No notifications yet']));
    } else {
      data.forEach(function (n) { list.appendChild(renderItem(n)); });
    }
    var unread = data.filter(function (n) { return !(n.is_read || n.isRead); }).length;
    badge.textContent = unread > 99 ? '99+' : String(unread);
    badge.style.display = unread ? 'inline-block' : 'none';
  }

  function markRead(id) {
    fetch('/.netlify/functions/admin-notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    }).then(function () {
      _cache.forEach(function (n) { if (n.id === id) { n.is_read = true; n.isRead = true; } });
      render(_cache);
    }).catch(function () {});
  }

  function markAllRead() {
    fetch('/.netlify/functions/admin-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-all-read' })
    }).then(function () {
      _cache.forEach(function (n) { n.is_read = true; n.isRead = true; });
      render(_cache);
    }).catch(function () {});
  }

  function pollUnreadCount() {
    fetch('/.netlify/functions/admin-notifications')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        _cache = data;
        var unread = data.filter(function (n) { return !(n.is_read || n.isRead); }).length;
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.style.display = unread ? 'inline-block' : 'none';
      })
      .catch(function () {});
  }

  function init() {
    var header = document.querySelector('header');
    if (!header) return;

    var whoEl = document.getElementById('whoami');
    if (!whoEl) return;

    var bellEl = buildBell();
    header.insertBefore(bellEl, whoEl);

    bellEl.style.display = 'none';

    var observer = new MutationObserver(function () {
      var isVisible = whoEl.style.display !== 'none';
      if (isVisible) {
        fetch('/.netlify/functions/admin-notifications', { method: 'GET' })
          .then(function (r) {
            if (r.ok) {
              bellEl.style.display = 'inline-flex';
              loadNotifications();
              setInterval(pollUnreadCount, POLL_MS);
              observer.disconnect();
            } else {
              bellEl.style.display = 'none';
            }
          })
          .catch(function () { bellEl.style.display = 'none'; });
      }
    });
    observer.observe(whoEl, { attributes: true, attributeFilter: ['style'] });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
