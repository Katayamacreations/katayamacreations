(function () {
  var POLL_MS = 30000;
  var bell, badge, dropdown, list, popup;

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

  function getToken() {
    var m = document.cookie.match(/(?:^|; )nf_jwt=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function buildBell() {
    var wrap = el('div', { id: 'userNotifBellWrap', style: { position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '12px' } });

    bell = el('button', {
      id: 'userNotifBellBtn',
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
      id: 'userNotifBadge',
      style: {
        display: 'none', position: 'absolute', top: '0', right: '2px',
        background: '#e74c3c', color: '#fff', fontSize: '11px', fontWeight: '700',
        borderRadius: '50%', minWidth: '18px', height: '18px', lineHeight: '18px',
        textAlign: 'center', padding: '0 4px', pointerEvents: 'none'
      }
    });
    bell.appendChild(badge);

    dropdown = el('div', {
      id: 'userNotifDropdown',
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

    list = el('div', { id: 'userNotifList' });
    dropdown.appendChild(list);

    wrap.appendChild(bell);
    wrap.appendChild(dropdown);

    document.addEventListener('click', function (e) {
      if (!wrap.contains(e.target)) dropdown.style.display = 'none';
    });

    return wrap;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function ensurePopup() {
    if (popup) return popup;
    popup = document.getElementById('loginMsgPopup');
    if (popup) return popup;
    popup = el('div', {
      id: 'loginMsgPopup',
      style: {
        display: 'none', position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.7)',
        zIndex: '10000', alignItems: 'center', justifyContent: 'center', padding: '20px'
      }
    }, [
      el('div', {
        style: {
          background: 'linear-gradient(160deg,#2d1b46,#1e1232)', border: '1px solid rgba(192,192,210,0.22)',
          borderRadius: '14px', padding: '24px', maxWidth: '420px', width: '100%',
          boxShadow: '0 22px 70px rgba(0,0,0,0.5)'
        }
      }, [
        el('div', { style: { fontSize: '28px', marginBottom: '10px' } }, ['\u{1F4AC}']),
        el('h3', { id: 'loginMsgPopupTitle', style: { margin: '0 0 8px', fontSize: '21px', color: '#e8e3f0' } }, ['You have a new message']),
        el('p', { id: 'loginMsgPopupBody', style: { margin: '0 0 22px', color: '#c0bcd0', fontSize: '14px', lineHeight: '1.5' } }),
        el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, [
          el('button', {
            type: 'button',
            id: 'loginMsgPopupReply',
            style: {
              background: 'linear-gradient(135deg,#4a2d75,#6b48a6)', border: '1px solid rgba(192,192,210,0.25)',
              borderRadius: '8px', color: '#e8e3f0', cursor: 'pointer', fontWeight: '700', padding: '10px 14px'
            }
          }, ['Read & reply']),
          el('button', {
            type: 'button',
            id: 'loginMsgPopupDismiss',
            style: {
              background: 'rgba(192,192,210,0.12)', border: '1px solid rgba(192,192,210,0.18)',
              borderRadius: '8px', color: '#e8e3f0', cursor: 'pointer', fontWeight: '700', padding: '10px 14px'
            }
          }, ['Maybe later'])
        ])
      ])
    ]);
    document.body.appendChild(popup);
    return popup;
  }

  function openMessageTarget(relatedId) {
    if (relatedId && typeof window._openUserThread === 'function') {
      window._openUserThread(relatedId);
      return;
    }
    if (relatedId) {
      window.location.href = '/account.html#messages';
      return;
    }
    window.location.href = '/account.html';
  }

  function showLoginMessagePopup(data) {
    var fresh = data.filter(function (n) {
      return !(n.is_read || n.isRead) &&
        (n.type === 'message' || n.type === 'reply') &&
        (n.related_id || n.relatedId);
    });
    if (!fresh.length) return;

    var shown = [];
    try { shown = JSON.parse(sessionStorage.getItem('shownMsgPopups') || '[]'); } catch (_) {}
    var unseen = fresh.filter(function (n) { return shown.indexOf(n.id) === -1; });
    if (!unseen.length) return;

    var latest = unseen[0];
    var relatedId = Number(latest.related_id || latest.relatedId);
    var popupEl = ensurePopup();
    document.getElementById('loginMsgPopupTitle').textContent =
      fresh.length > 1 ? 'You have ' + fresh.length + ' new messages' : 'You have a new message';
    document.getElementById('loginMsgPopupBody').textContent =
      String(latest.body || latest.title || 'The team sent you a message.').slice(0, 240);
    popupEl.style.display = 'flex';

    sessionStorage.setItem('shownMsgPopups', JSON.stringify(shown.concat(fresh.map(function (n) { return n.id; }))));
    document.getElementById('loginMsgPopupReply').onclick = function () {
      popupEl.style.display = 'none';
      openMessageTarget(relatedId);
    };
    document.getElementById('loginMsgPopupDismiss').onclick = function () {
      popupEl.style.display = 'none';
    };
  }

  function renderItem(n) {
    var icons = { reply: '\u{1F4AC}', order: '\u{1F4E6}' };
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
        var msgCard = document.getElementById('myMessagesCard');
        if (msgCard) msgCard.scrollIntoView({ behavior: 'smooth' });
      }
    }, [
      el('span', { style: { fontSize: '20px', flexShrink: '0' } }, [icons[n.type] || '\u{1F514}']),
      el('div', { style: { flex: '1', minWidth: '0' } }, [
        el('div', { style: { fontSize: '13px', fontWeight: (n.is_read || n.isRead) ? '400' : '600', color: '#e8e3f0' } }, [escapeHtml(n.title || 'Notification')]),
        el('div', { style: { fontSize: '12px', color: '#b8b3c8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, [escapeHtml(n.body || '')]),
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
    var token = getToken();
    if (!token) return;
    fetch('/.netlify/functions/user-notifications', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        _cache = data;
        render(data);
        showLoginMessagePopup(data);
        if (data.some(function (n) { return !(n.is_read || n.isRead); })) {
          refreshMessages();
        }
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
    var token = getToken();
    if (!token) return;
    fetch('/.netlify/functions/user-notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ id: id })
    }).then(function () {
      _cache.forEach(function (n) { if (n.id === id) { n.is_read = true; n.isRead = true; } });
      render(_cache);
    }).catch(function () {});
  }

  function markAllRead() {
    var token = getToken();
    if (!token) return;
    fetch('/.netlify/functions/user-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'mark-all-read' })
    }).then(function () {
      _cache.forEach(function (n) { n.is_read = true; n.isRead = true; });
      render(_cache);
    }).catch(function () {});
  }

  function refreshMessages() {
    if (typeof window._refreshUserMessages === 'function') {
      window._refreshUserMessages();
    }
  }

  function pollUnreadCount() {
    var token = getToken();
    if (!token) return;
    fetch('/.netlify/functions/user-notifications', {
      headers: { Authorization: 'Bearer ' + token }
    })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        var hadUnread = _cache.some(function (n) { return !(n.is_read || n.isRead); });
        _cache = data;
        var unread = data.filter(function (n) { return !(n.is_read || n.isRead); }).length;
        badge.textContent = unread > 99 ? '99+' : String(unread);
        badge.style.display = unread ? 'inline-block' : 'none';
        showLoginMessagePopup(data);
        if (unread && !hadUnread) {
          refreshMessages();
        }
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
        bellEl.style.display = 'inline-flex';
        loadNotifications();
        setInterval(pollUnreadCount, POLL_MS);
        observer.disconnect();
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
