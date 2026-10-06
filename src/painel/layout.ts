type MenuItem = { key: string; icone: string; nome: string; href: string }

const MENU: MenuItem[] = [
  { key: 'inicio', icone: '🏠', nome: 'Início', href: '/' },
  { key: 'pedidos', icone: '📋', nome: 'Pedidos', href: '/pedidos' },
  { key: 'vendas', icone: '💵', nome: 'Vendas Avulsas', href: '/vendas' },
  { key: 'produtos', icone: '🍔', nome: 'Produtos', href: '/produtos' },
  { key: 'estoque', icone: '📦', nome: 'Estoque', href: '/estoque' },
  { key: 'combos', icone: '🎁', nome: 'Combos', href: '/combos' },
  { key: 'promocoes', icone: '🏷️', nome: 'Promoções', href: '/promocoes' },
  { key: 'categorias', icone: '🗂️', nome: 'Categorias', href: '/categorias' },
  { key: 'clientes', icone: '👥', nome: 'Clientes', href: '/clientes' },
  { key: 'embalagens', icone: '🧺', nome: 'Embalagens', href: '/embalagens' },
  { key: 'bairros', icone: '📍', nome: 'Bairros', href: '/bairros' },
  { key: 'entregadores', icone: '🛵', nome: 'Entregadores', href: '/entregadores' },
  { key: 'comandas', icone: '🧾', nome: 'Comandas', href: '/comandas' },
  { key: 'financeiro', icone: '💰', nome: 'Financeiro', href: '/financeiro' },
  { key: 'configuracoes', icone: '⚙️', nome: 'Configurações', href: '/configuracoes' },
  { key: 'importar', icone: '📸', nome: 'Importar Cardápio', href: '/importar-menu' },
  { key: 'usuarios', icone: '🔐', nome: 'Usuários', href: '/usuarios' }
]

export function renderLayout(titulo: string, conteudo: string, ativo = '') {
  const links = MENU.map((m) => `
    <a href="${m.href}" class="menu-item ${ativo === m.key ? 'ativo' : ''}">
      <span class="mi-icone">${m.icone}</span>
      <span class="mi-nome">${m.nome}</span>
    </a>
  `).join('')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${titulo} - Painel Admin</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Segoe UI', Arial, sans-serif; background:#f4f6f9; }

  /* ---------- SIDEBAR ---------- */
  .sidebar {
    position:fixed;
    left:0;
    top:0;
    bottom:0;
    width:260px;
    background:#1a1a2e;
    color:#fff;
    display:flex;
    flex-direction:column;
    z-index:1000;
    transition:transform 0.3s ease;
    overflow-y:auto;
  }
  .sidebar-logo {
    padding:20px 16px;
    display:flex;
    gap:12px;
    align-items:center;
    border-bottom:1px solid rgba(255,255,255,.08);
  }
  .logo-holder { position:relative; width:46px; height:46px; flex:none; }
  .logo-circle {
    position:absolute;
    inset:0;
    width:46px;
    height:46px;
    border-radius:50%;
    background:#ff6b00;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:24px;
  }
  .logo-img {
    position:absolute;
    inset:0;
    width:46px;
    height:46px;
    border-radius:50%;
    object-fit:cover;
    background:#0d0d0d;
    box-shadow:0 0 0 2px rgba(255,255,255,.15);
    display:none;
  }
  .sl-texto strong { font-size:13px; display:block; line-height:1.25; }
  .sl-texto small { color:#9aa0b5; font-size:11px; }
  .sidebar-nav { padding:12px 8px; display:flex; flex-direction:column; gap:3px; }
  .menu-item {
    display:flex;
    align-items:center;
    gap:12px;
    padding:13px 14px;
    border-radius:10px;
    color:#cfd2e0;
    text-decoration:none;
    font-size:14px;
    font-weight:600;
  }
  .menu-item .mi-icone { font-size:17px; }
  .menu-item:hover { background:rgba(255,255,255,.07); color:#fff; }
  .menu-item.ativo { background:#ff6b00; color:#fff; }

  /* ---------- ÁREA PRINCIPAL ---------- */
  .main {
    margin-left:260px;
    min-height:100vh;
    display:flex;
    flex-direction:column;
    transition:margin-left 0.3s ease;
  }
  .topbar {
    position:sticky;
    top:0;
    z-index:900;
    background:#fff;
    box-shadow:0 2px 8px rgba(0,0,0,.06);
    display:flex;
    align-items:center;
    gap:12px;
    padding:12px 18px;
  }
  .btn-hamburger {
    display:none;
    border:none;
    background:#1a1a2e;
    color:#fff;
    font-size:22px;
    width:46px;
    height:46px;
    border-radius:10px;
    cursor:pointer;
    flex:none;
  }
  .topbar-titulo {
    font-size:18px;
    margin:0;
    color:#333;
    flex:1;
    min-width:0;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .topbar-acoes { display:flex; gap:8px; flex:none; }
  .tb-btn {
    padding:10px 14px;
    border-radius:20px;
    color:#fff;
    text-decoration:none;
    font-size:13px;
    font-weight:bold;
    white-space:nowrap;
  }
  .tb-btn.azul { background:#0d6efd; }
  .tb-btn.vermelho { background:#dc3545; }
  .conteudo { padding:20px; flex:1; }

  .overlay-menu {
    display:none;
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.6);
    z-index:950;
    opacity:0;
    transition:opacity 0.3s ease;
  }
  .overlay-menu.visivel {
    display:block;
    opacity:1;
  }

  /* ---------- MOBILE (até 1024px) ---------- */
  @media (max-width:1024px) {
    .sidebar {
      transform:translateX(-100%);
      width:280px;
    }
    .sidebar.aberto {
      transform:translateX(0);
      box-shadow:0 0 50px rgba(0,0,0,.5);
    }
    .main {
      margin-left:0;
    }
    .btn-hamburger {
      display:block;
    }
    .conteudo { padding:14px; }
    .topbar-titulo { font-size:16px; }
    .tb-btn { padding:10px 12px; font-size:12px; }

    /* ajustes globais de conteúdo no celular */
    h1 { font-size:22px !important; }
    .cards { grid-template-columns:1fr 1fr !important; gap:10px !important; }
    .card { padding:14px !important; }
    .card h3 { font-size:20px !important; }
    .box { padding:16px !important; overflow-x:auto; }
    .form-grid { grid-template-columns:1fr !important; }
    .duas-colunas { grid-template-columns:1fr !important; }
    .filtros { flex-direction:column !important; align-items:stretch !important; }
    .filtros input, .filtros select { width:100% !important; font-size:16px; }
    .form-group input, .form-group select, .form-group textarea { font-size:16px; }
    .form-linha { flex-direction:column !important; }
    .form-linha input { width:100% !important; }
    .pdf-actions { flex-direction:column; }
    .fornecedor-grid { grid-template-columns:1fr !important; }
    table { font-size:13px; }
    th, td { padding:8px 6px !important; }
    .btn, .btn-filtrar, .btn-salvar, .btn-pdf, .btn-ler, .btn-confirmar, .btn-add { min-height:46px; font-size:15px; }
  }
</style>
</head>
<body>

<div id="overlayMenu" class="overlay-menu"></div>

<aside id="sidebar" class="sidebar">
  <div class="sidebar-logo">
    <div class="logo-holder">
      <div class="logo-circle" id="logoFallback">🍔</div>
      <img id="logoSidebar" class="logo-img" alt="Chef da Brasa">
    </div>
    <div class="sl-texto">
      <strong>CHEF DA BRASA</strong>
      <small>Painel Admin</small>
    </div>
  </div>
  <nav class="sidebar-nav">${links}</nav>
</aside>

<div class="main">
  <header class="topbar">
    <button id="btnMenu" class="btn-hamburger" aria-label="Abrir menu">☰</button>
    <h1 class="topbar-titulo">${titulo}</h1>
    <div class="topbar-acoes">
      <a href="/perfil" class="tb-btn azul">⚙️ Perfil</a>
      <a href="/logout" class="tb-btn vermelho">Sair</a>
    </div>
  </header>
  <main class="conteudo">${conteudo}</main>
</div>

<script>
  (function() {
    // Buscar logo real da loja
    var img = document.getElementById('logoSidebar');
    var fallback = document.getElementById('logoFallback');
    if (img && fallback) {
      img.onerror = function() {
        img.style.display = 'none';
        fallback.style.display = 'flex';
      };
      fetch('/api/loja/status')
        .then(function(r) { return r.json(); })
        .then(function(j) {
          var url = j.logo_url || j.logo || '';
          if (!url) return;
          img.onload = function() {
            img.style.display = 'block';
            fallback.style.display = 'none';
          };
          img.src = url;
        })
        .catch(function() {});
    }

    // Menu hambúrguer
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('overlayMenu');
    var btn = document.getElementById('btnMenu');

    function abrirMenu() {
      sb.classList.add('aberto');
      ov.classList.add('visivel');
      document.body.style.overflow = 'hidden';
    }
    function fecharMenu() {
      sb.classList.remove('aberto');
      ov.classList.remove('visivel');
      document.body.style.overflow = '';
    }

    if (btn) {
      btn.onclick = function() {
        if (sb.classList.contains('aberto')) {
          fecharMenu();
        } else {
          abrirMenu();
        }
      };
    }

    if (ov) {
      ov.onclick = fecharMenu;
    }

    document.querySelectorAll('.menu-item').forEach(function(a) {
      a.addEventListener('click', fecharMenu);
    });
  })();
</script>

</body>
</html>`
}