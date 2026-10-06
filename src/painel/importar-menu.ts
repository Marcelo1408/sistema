import { Hono } from 'hono'
import { renderLayout } from './layout'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', async (c) => {
  const conteudo = `
    <style>
      .box-imp { background:#fff; border-radius:15px; padding:25px; box-shadow:0 3px 15px rgba(0,0,0,.08); margin-bottom:20px; }
      .box-imp h3 { margin:0 0 15px; color:#333; }
      .btn-ler { background:#ff6b00; color:#fff; border:none; padding:13px 24px; border-radius:10px; cursor:pointer; font-weight:bold; font-size:15px; }
      .btn-ler:disabled { background:#ccc; cursor:not-allowed; }
      .btn-confirmar { background:#198754; color:#fff; border:none; padding:14px 26px; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px; margin-top:15px; }
      .btn-confirmar:disabled { background:#ccc; cursor:not-allowed; }
      .imp-item { display:grid; grid-template-columns:36px 1fr 80px 110px 120px; gap:8px; align-items:center; margin-bottom:8px; background:#fafafa; padding:10px; border-radius:10px; }
      .imp-item input[type="checkbox"] { width:20px; height:20px; cursor:pointer; }
      .imp-item input[type="text"], .imp-item input[type="number"] { padding:10px; border:1px solid #ddd; border-radius:8px; width:100%; box-sizing:border-box; }
      .imp-head { display:grid; grid-template-columns:36px 1fr 80px 110px 120px; gap:8px; padding:0 10px 6px; font-size:12px; font-weight:bold; color:#777; text-transform:uppercase; }
      .loading { text-align:center; color:#666; padding:25px; font-size:15px; }
      .toast { position:fixed; top:20px; left:50%; transform:translateX(-50%) translateY(-90px); background:#198754; color:#fff; padding:14px 28px; border-radius:12px; font-weight:bold; box-shadow:0 6px 20px rgba(0,0,0,.25); z-index:2000; transition:transform .35s ease; }
      .toast.visivel { transform:translateX(-50%) translateY(0); }
      .tipo-seletor { display:flex; gap:12px; margin:15px 0; flex-wrap:wrap; }
      .tipo-opcao { flex:1; min-width:220px; border:2px solid #ddd; border-radius:12px; padding:14px; cursor:pointer; transition:all .2s; background:#fff; }
      .tipo-opcao:hover { border-color:#ff6b00; }
      .tipo-opcao.ativo { border-color:#ff6b00; background:#fff5ec; }
      .tipo-opcao h4 { margin:0 0 4px; color:#333; font-size:15px; }
      .tipo-opcao p { margin:0; color:#666; font-size:13px; }
      .resumo-total { background:#fff5ec; border:2px dashed #ff6b00; border-radius:12px; padding:15px; margin-top:15px; text-align:center; }
      .resumo-total b { color:#ff6b00; font-size:20px; }
      .hint-preco { font-size:11px; color:#888; display:block; margin-top:2px; }

      /* Box do fornecedor */
      .fornecedor-box { background:#fff5ec; border:2px solid #ff6b00; border-radius:12px; padding:20px; margin-bottom:20px; }
      .fornecedor-box h3 { margin:0 0 10px; color:#ff6b00; font-size:16px; }
      .fornecedor-box p.hint { color:#666; font-size:13px; margin-bottom:14px; }
      .fornecedor-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      .fornecedor-grid label { display:block; font-size:12px; color:#555; font-weight:bold; margin-bottom:4px; }
      .fornecedor-grid input { width:100%; padding:10px; border:1px solid #ddd; border-radius:8px; box-sizing:border-box; font-size:14px; background:#fff; }
      .fornecedor-grid .full { grid-column:1 / -1; }

      @media (max-width:800px){
        .imp-item, .imp-head { grid-template-columns:30px 1fr 70px 90px; }
        .imp-cat { display:none; }
        .fornecedor-grid { grid-template-columns:1fr; }
      }
      @media (max-width:500px){
        .imp-item, .imp-head { grid-template-columns:30px 1fr 70px; }
        .imp-preco-wrap { display:none; }
      }
    </style>

    <h1 style="margin-bottom:20px; color:#333;">📸 Importar Cardápio / Nota por Foto</h1>

    <div class="box-imp">
      <h3>1️⃣ Envie a foto</h3>
      <p style="color:#666; font-size:14px; margin-bottom:15px;">
        A IA vai ler a foto e extrair <b>dados do fornecedor</b> (nome, CNPJ, endereço...) e <b>itens</b> (nome, quantidade, preço). Títulos, logotipos e itens riscados são descartados automaticamente.
      </p>
      <input type="file" id="inpFoto" accept="image/*" style="margin-bottom:15px;">
      <br>
      <button id="btnLerFoto" class="btn-ler">🔍 Ler Foto</button>
    </div>

    <div id="impLoading" class="box-imp loading" style="display:none;">
      🤖 Lendo a foto com inteligência artificial... isso pode levar até 30 segundos.
    </div>

    <div id="impPreview" class="box-imp" style="display:none;">
      <h3>2️⃣ Tipo da importação</h3>
      <p style="color:#666; font-size:14px; margin-bottom:5px;">
        Escolha se é um <b>cardápio</b> (produtos que você vende) ou uma <b>nota fiscal</b> (compra de insumos — lança saída no financeiro).
      </p>
      <div class="tipo-seletor">
        <div class="tipo-opcao ativo" data-tipo="CARDAPIO">
          <h4>📋 Cardápio</h4>
          <p>Apenas cadastra produtos no cardápio. Não mexe no financeiro.</p>
        </div>
        <div class="tipo-opcao" data-tipo="NOTA">
          <h4>🧾 Nota fiscal (compra)</h4>
          <p>Cadastra produtos <b>e</b> lança uma SAÍDA no financeiro com os dados do fornecedor.</p>
        </div>
      </div>

      <!-- BOX DO FORNECEDOR -->
      <div id="boxFornecedor" class="fornecedor-box" style="display:none;">
        <h3>🏪 Dados do Comércio / Fornecedor</h3>
        <p class="hint">A IA extraiu automaticamente. Revise e corrija se precisar.</p>
        <div class="fornecedor-grid">
          <div>
            <label>Nome do Comércio *</label>
            <input type="text" id="fNome" placeholder="Ex: Atacadão Central">
          </div>
          <div>
            <label>CNPJ</label>
            <input type="text" id="fCnpj" placeholder="00.000.000/0000-00" maxlength="18">
          </div>
          <div class="full">
            <label>Endereço Completo</label>
            <input type="text" id="fEndereco" placeholder="Rua, número, bairro, cidade/UF">
          </div>
          <div>
            <label>Telefone</label>
            <input type="text" id="fTelefone" placeholder="(00) 0000-0000">
          </div>
          <div>
            <label>Nº da Nota</label>
            <input type="text" id="fNumeroNota" placeholder="123456">
          </div>
          <div>
            <label>Data de Emissão</label>
            <input type="date" id="fDataEmissao">
          </div>
        </div>
      </div>

      <h3 style="margin-top:25px;">3️⃣ Revise os itens (<span id="impQtd">0</span>)</h3>
      <p style="color:#666; font-size:14px; margin-bottom:15px;">
        Desmarque o que <b>NÃO</b> é produto, corrija <b>quantidade</b> e <b>preço unitário</b> se precisar.
      </p>
      <div class="imp-head">
        <span></span>
        <span>Nome</span>
        <span>Qtd</span>
        <span>Preço un.</span>
        <span class="imp-cat">Categoria</span>
      </div>
      <div id="impLista"></div>

      <div id="resumoNota" class="resumo-total" style="display:none;">
        💰 Total da nota: <b id="resumoTotal">R$ 0,00</b>
        <br><small style="color:#666;">Este valor será lançado como SAÍDA no financeiro (categoria INSUMOS).</small>
      </div>

      <button id="btnConfirmar" class="btn-confirmar">✅ Cadastrar Selecionados</button>
    </div>

    <div id="toastImport" class="toast"></div>

    <script>
      function escHtml(s) {
        return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
      }

      function fmtBRL(v) {
        return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
      }

      function lerJson(r) {
        return r.text().then(function (t) {
          try {
            return { ok: r.ok, d: JSON.parse(t) };
          } catch (e) {
            return { ok: false, d: { erro: 'Servidor respondeu: ' + t.slice(0, 140) } };
          }
        });
      }

      function mostrarToast(msg) {
        var t = document.getElementById('toastImport');
        t.textContent = msg;
        t.classList.add('visivel');
        setTimeout(function () { t.classList.remove('visivel'); }, 4000);
      }

      function fileParaJpegBase64(file, maxLado) {
        return new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onload = function () {
            var img = new Image();
            img.onload = function () {
              try {
                var escala = Math.min(1, maxLado / Math.max(img.width, img.height));
                var canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(img.width * escala));
                canvas.height = Math.max(1, Math.round(img.height * escala));
                var ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
              } catch (e) { reject(new Error('Erro ao processar a imagem.')); }
            };
            img.onerror = function () { reject(new Error('Formato de imagem nao suportado. Use JPG ou PNG.')); };
            img.src = reader.result;
          };
          reader.onerror = function () { reject(new Error('Nao foi possivel ler o arquivo.')); };
          reader.readAsDataURL(file);
        });
      }

      // Formata CNPJ ao digitar
      function formatarCNPJ(v) {
        var n = String(v || '').replace(/\D/g, '').slice(0, 14);
        if (n.length <= 14) {
          return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2}).*/, '$1.$2.$3/$4-$5');
        }
        return n;
      }
      document.getElementById('fCnpj').addEventListener('input', function (e) {
        e.target.value = formatarCNPJ(e.target.value);
      });

      // Estado
      var tipoSelecionado = 'CARDAPIO';
      var dadosFornecedor = {};

      document.querySelectorAll('.tipo-opcao').forEach(function (op) {
        op.onclick = function () {
          document.querySelectorAll('.tipo-opcao').forEach(function (x) { x.classList.remove('ativo'); });
          op.classList.add('ativo');
          tipoSelecionado = op.dataset.tipo;
          atualizarResumo();
        };
      });

      function atualizarResumo() {
        var linhas = document.querySelectorAll('.imp-item');
        var total = 0;
        for (var k = 0; k < linhas.length; k++) {
          var l = linhas[k];
          var chk = l.querySelector('input[type="checkbox"]');
          if (!chk.checked) continue;
          var preco = Number(l.querySelector('.imp-preco').value) || 0;
          var qtd = Number(l.querySelector('.imp-qtd').value) || 0;
          var subtotal = preco * qtd;
          var lbl = l.querySelector('.imp-subtotal');
          if (lbl) lbl.textContent = 'Subtotal: ' + fmtBRL(subtotal);
          total += subtotal;
        }
        var resumo = document.getElementById('resumoNota');
        var totalEl = document.getElementById('resumoTotal');
        if (tipoSelecionado === 'NOTA' && total > 0) {
          resumo.style.display = 'block';
          totalEl.textContent = fmtBRL(total);
        } else {
          resumo.style.display = 'none';
        }
      }

      function renderPreview(itens, fornecedor) {
        var box = document.getElementById('impPreview');
        var lista = document.getElementById('impLista');
        var btnOk = document.getElementById('btnConfirmar');
        var boxF = document.getElementById('boxFornecedor');
        box.style.display = 'block';
        document.getElementById('impQtd').textContent = itens.length;

        // Popula box do fornecedor
        dadosFornecedor = fornecedor || {};
        if (dadosFornecedor.nome_comercio || dadosFornecedor.cnpj || dadosFornecedor.endereco) {
          document.getElementById('fNome').value = dadosFornecedor.nome_comercio || '';
          document.getElementById('fCnpj').value = formatarCNPJ(dadosFornecedor.cnpj || '');
          document.getElementById('fEndereco').value = dadosFornecedor.endereco || '';
          document.getElementById('fTelefone').value = dadosFornecedor.telefone || '';
          document.getElementById('fNumeroNota').value = dadosFornecedor.numero_nota || '';
          document.getElementById('fDataEmissao').value = dadosFornecedor.data_emissao || '';
          boxF.style.display = 'block';
        } else {
          boxF.style.display = 'none';
        }

        if (!itens || !itens.length) {
          lista.innerHTML = '<p style="color:#888; text-align:center; padding:20px;">Nenhum produto reconhecido na foto. Tente uma foto mais nitida.</p>';
          btnOk.style.display = 'none';
          return;
        }
        btnOk.style.display = '';
        var html = '';
        for (var k = 0; k < itens.length; k++) {
          var i = itens[k];
          var precoUnit = Number(i.preco_unitario || i.preco || 0);
          var qtd = Number(i.quantidade || 1) || 1;
          var subtotal = precoUnit * qtd;
          html += '<div class="imp-item">' +
            '<input type="checkbox" checked>' +
            '<div>' +
              '<input type="text" class="imp-nome" value="' + escHtml(i.nome) + '" placeholder="Nome do produto">' +
              '<span class="hint-preco imp-subtotal">Subtotal: ' + fmtBRL(subtotal) + '</span>' +
            '</div>' +
            '<input type="number" step="0.01" min="0" class="imp-qtd" value="' + qtd + '" title="Quantidade">' +
            '<div class="imp-preco-wrap">' +
              '<input type="number" step="0.01" min="0" class="imp-preco" value="' + precoUnit + '" title="Preço unitário">' +
            '</div>' +
            '<div class="imp-cat-wrap">' +
              '<input type="text" class="imp-cat" value="' + escHtml(i.categoria) + '" placeholder="Categoria">' +
            '</div>' +
            '</div>';
        }
        lista.innerHTML = html;
        lista.addEventListener('input', atualizarResumo);
        lista.addEventListener('change', atualizarResumo);
        atualizarResumo();
      }

      document.getElementById('btnLerFoto').onclick = function () {
        var input = document.getElementById('inpFoto');
        if (!input.files.length) { alert('Escolha uma foto primeiro.'); return; }
        var btn = document.getElementById('btnLerFoto');
        btn.disabled = true;
        btn.textContent = '🔍 Lendo foto... (até 30s)';
        document.getElementById('impLoading').style.display = 'block';
        document.getElementById('impPreview').style.display = 'none';
        fileParaJpegBase64(input.files[0], 1568)
          .then(function (base64) {
            return fetch('/api/importar-menu/foto', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imagem_base64: base64 })
            });
          })
          .then(lerJson)
          .then(function (res) {
            if (!res.ok) throw new Error(res.d.erro || 'Erro ao ler a foto');
            renderPreview(res.d.itens || [], res.d.fornecedor || {});
          })
          .catch(function (e) {
            alert(e.message);
          })
          .finally(function () {
            btn.disabled = false;
            btn.textContent = '🔍 Ler Foto';
            document.getElementById('impLoading').style.display = 'none';
          });
      };

      document.getElementById('btnConfirmar').onclick = function () {
        var linhas = document.querySelectorAll('.imp-item');
        var itens = [];
        for (var k = 0; k < linhas.length; k++) {
          var l = linhas[k];
          var chk = l.querySelector('input[type="checkbox"]');
          if (!chk.checked) continue;
          var precoUnit = Number(l.querySelector('.imp-preco').value) || 0;
          var qtd = Number(l.querySelector('.imp-qtd').value) || 1;
          itens.push({
            nome: l.querySelector('.imp-nome').value.trim(),
            preco_unitario: precoUnit,
            quantidade: qtd,
            valor_total: +(precoUnit * qtd).toFixed(2),
            categoria: (l.querySelector('.imp-cat') ? l.querySelector('.imp-cat').value.trim() : '') || 'OUTROS',
            descricao: ''
          });
        }
        if (!itens.length) { alert('Marque pelo menos um item para cadastrar.'); return; }

        // Captura fornecedor dos inputs (pode ter sido editado pelo usuário)
        var fornecedor = {
          nome_comercio: document.getElementById('fNome').value.trim(),
          cnpj: document.getElementById('fCnpj').value.replace(/\D/g, ''),
          endereco: document.getElementById('fEndereco').value.trim(),
          telefone: document.getElementById('fTelefone').value.trim(),
          numero_nota: document.getElementById('fNumeroNota').value.trim(),
          data_emissao: document.getElementById('fDataEmissao').value || ''
        };

        var btn = document.getElementById('btnConfirmar');
        btn.disabled = true;
        btn.textContent = 'Cadastrando...';
        fetch('/api/importar-menu/confirmar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itens: itens, tipo: tipoSelecionado, fornecedor: fornecedor })
        })
          .then(lerJson)
          .then(function (res) {
            if (!res.ok) throw new Error(res.d.erro || 'Erro ao cadastrar');
            var msg;
            if (tipoSelecionado === 'NOTA') {
              msg = '🧾 Nota lançada no financeiro com ' + (res.d.itensNota || 0) + ' itens! Nada foi para o cardápio.';
            } else {
              msg = '✅ ' + res.d.criados + ' produto(s) cadastrado(s) no cardápio!';
            }
            if (res.d.falhas > 0) {
              msg += ' | ⚠️ ' + res.d.falhas + ' falha(s) ignorada(s).';
            }
            if (res.d.lancamentoFinanceiro) {
              msg += ' | 💸 Saída de ' + fmtBRL(res.d.totalNota) + ' lançada no financeiro.';
            }
            mostrarToast(msg);
            setTimeout(function () {
              if (res.d.lancamentoFinanceiro) {
                window.location.href = '/financeiro';
              } else {
                window.location.href = '/produtos';
              }
            }, 2500);
          })
          .catch(function (e) {
            alert(e.message);
            btn.disabled = false;
            btn.textContent = '✅ Cadastrar Selecionados';
          });
      };
    </script>
  `

  return c.html(renderLayout('Importar Cardápio', conteudo, 'produtos'))
})

export default app