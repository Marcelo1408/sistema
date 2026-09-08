<?php
session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

function h($valor){
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

function normalizarData($data, $padrao){
    $data = trim((string)$data);
    if(preg_match('/^\d{4}-\d{2}-\d{2}$/', $data)){
        return $data;
    }
    return $padrao;
}

function normalizarValor($valor){
    $valor = trim((string)$valor);
    $valor = str_replace(['R$', ' '], '', $valor);

    if(strpos($valor, ',') !== false){
        $valor = str_replace('.', '', $valor);
        $valor = str_replace(',', '.', $valor);
    }

    return max(0, (float)$valor);
}

function garantirFinanceiro($conn){
    $conn->query("CREATE TABLE IF NOT EXISTS financeiro (
        id INT(11) NOT NULL AUTO_INCREMENT,
        tipo ENUM('ENTRADA','SAIDA') NOT NULL,
        descricao VARCHAR(255) NOT NULL,
        valor DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        data_movimento DATE NOT NULL,
        forma_pagamento VARCHAR(50) DEFAULT NULL,
        observacao TEXT DEFAULT NULL,
        pedido_id INT(11) DEFAULT NULL,
        automatico TINYINT(1) NOT NULL DEFAULT 0,
        categoria VARCHAR(50) DEFAULT NULL,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_financeiro_pedido_id (pedido_id),
        KEY idx_financeiro_data (data_movimento),
        KEY idx_financeiro_tipo (tipo)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $col = $conn->query("SHOW COLUMNS FROM financeiro LIKE 'pedido_id'");
    if($col && $col->num_rows == 0){
        $conn->query("ALTER TABLE financeiro ADD COLUMN pedido_id INT(11) DEFAULT NULL AFTER observacao");
    }

    $col = $conn->query("SHOW COLUMNS FROM financeiro LIKE 'automatico'");
    if($col && $col->num_rows == 0){
        $conn->query("ALTER TABLE financeiro ADD COLUMN automatico TINYINT(1) NOT NULL DEFAULT 0 AFTER pedido_id");
    }

    $col = $conn->query("SHOW COLUMNS FROM financeiro LIKE 'categoria'");
    if($col && $col->num_rows == 0){
        $conn->query("ALTER TABLE financeiro ADD COLUMN categoria VARCHAR(50) DEFAULT NULL AFTER automatico");
    }

    $idx = $conn->query("SHOW INDEX FROM financeiro WHERE Key_name='idx_financeiro_pedido_id'");
    if($idx && $idx->num_rows == 0){
        $conn->query("ALTER TABLE financeiro ADD INDEX idx_financeiro_pedido_id (pedido_id)");
    }

    $idx = $conn->query("SHOW INDEX FROM financeiro WHERE Key_name='idx_financeiro_data'");
    if($idx && $idx->num_rows == 0){
        $conn->query("ALTER TABLE financeiro ADD INDEX idx_financeiro_data (data_movimento)");
    }
}

garantirFinanceiro($conn);

/*
|--------------------------------------------------------------------------
| REGISTRAR COMPRA / DESPESA MANUAL
|--------------------------------------------------------------------------
| As vendas entram automaticamente pela API de pedidos.
| Este formulário fica apenas para registrar compras e despesas.
*/

if(isset($_POST['salvar_compra'])){

    $data_movimento = normalizarData($_POST['data_movimento'] ?? '', date('Y-m-d'));
    $forma_pagamento = $conn->real_escape_string($_POST['forma_pagamento'] ?? 'PIX');
    $observacao_geral = trim((string)($_POST['observacao'] ?? ''));

    $itens = $_POST['item'] ?? [];
    $quantidades = $_POST['quantidade'] ?? [];
    $unidades = $_POST['unidade'] ?? [];
    $valores = $_POST['valor'] ?? [];

    $salvos = 0;

    foreach($itens as $i => $item){
        $item = trim((string)$item);
        $valor = normalizarValor($valores[$i] ?? 0);
        $quantidade = trim((string)($quantidades[$i] ?? ''));
        $unidade = trim((string)($unidades[$i] ?? ''));

        if($item === '' || $valor <= 0){
            continue;
        }

        $descricao = 'Compra - ' . $item;

        if($quantidade !== ''){
            $descricao .= ' (' . $quantidade;
            if($unidade !== ''){
                $descricao .= ' ' . $unidade;
            }
            $descricao .= ')';
        }

        $obs = $observacao_geral;

        $descricao_sql = $conn->real_escape_string($descricao);
        $obs_sql = $conn->real_escape_string($obs);
        $valor_sql = number_format($valor, 2, '.', '');

        $conn->query("
            INSERT INTO financeiro
            (tipo, descricao, valor, data_movimento, forma_pagamento, observacao, automatico, categoria)
            VALUES
            ('SAIDA', '$descricao_sql', '$valor_sql', '$data_movimento', '$forma_pagamento', '$obs_sql', 0, 'COMPRA')
        ");

        $salvos++;
    }

    header('Location: financeiro.php?sucesso=' . $salvos);
    exit;
}

/*
|--------------------------------------------------------------------------
| EXCLUIR SOMENTE LANÇAMENTO MANUAL
|--------------------------------------------------------------------------
*/

if(isset($_GET['excluir'])){

    $id = intval($_GET['excluir']);

    $conn->query("
        DELETE FROM financeiro
        WHERE id='$id'
        AND IFNULL(automatico,0)=0
    ");

    header('Location: financeiro.php');
    exit;
}

/*
|--------------------------------------------------------------------------
| FILTRO POR DATA
|--------------------------------------------------------------------------
*/

$data_inicio = normalizarData($_GET['data_inicio'] ?? '', date('Y-m-01'));
$data_fim = normalizarData($_GET['data_fim'] ?? '', date('Y-m-d'));

$where = "
WHERE data_movimento BETWEEN '$data_inicio' AND '$data_fim'
";

/*
|--------------------------------------------------------------------------
| CARDS
|--------------------------------------------------------------------------
*/

$entradas = $conn->query("
SELECT COALESCE(SUM(valor),0) total
FROM financeiro
$where
AND tipo='ENTRADA'
")->fetch_assoc();

$vendasAutomaticas = $conn->query("
SELECT COALESCE(SUM(valor),0) total
FROM financeiro
$where
AND tipo='ENTRADA'
AND IFNULL(automatico,0)=1
")->fetch_assoc();

$saidas = $conn->query("
SELECT COALESCE(SUM(valor),0) total
FROM financeiro
$where
AND tipo='SAIDA'
")->fetch_assoc();

$comprasManuais = $conn->query("
SELECT COALESCE(SUM(valor),0) total
FROM financeiro
$where
AND tipo='SAIDA'
AND IFNULL(automatico,0)=0
")->fetch_assoc();

$lucro = $entradas['total'] - $saidas['total'];

$movimentacoes = $conn->query("
SELECT *
FROM financeiro
$where
ORDER BY data_movimento DESC, id DESC
");

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Financeiro</title>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>
.dashboard{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:20px;
    margin-bottom:25px;
}

.card-info,
.form-card,
.table-box,
.filtro-box,
.aviso-box{
    background:#fff;
    padding:25px;
    border-radius:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
    margin-bottom:25px;
}

.entrada{ color:#198754; }
.saida{ color:#dc3545; }
.lucro{ color:#ff6b00; }
.info{ color:#0d6efd; }

.form-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:15px;
}

.form-group{
    margin-bottom:15px;
}

.form-group label{
    display:block;
    margin-bottom:5px;
    font-weight:bold;
}

.form-group input,
.form-group select,
.form-group textarea{
    width:100%;
    padding:10px;
    border:1px solid #ddd;
    border-radius:8px;
}

.btn-salvar{
    background:#198754;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}

.btn-filtrar{
    background:#ff6b00;
    color:#fff;
    border:none;
    padding:11px 20px;
    border-radius:8px;
    cursor:pointer;
}

.btn-add{
    background:#0d6efd;
    color:#fff;
    border:none;
    padding:10px 14px;
    border-radius:8px;
    cursor:pointer;
    margin:10px 0 15px 0;
}

.btn-add-bottom{
    margin-top:12px;
}

.btn-remover-item{
    background:#dc3545;
    color:#fff;
    border:none;
    padding:8px 10px;
    border-radius:8px;
    cursor:pointer;
}

.itens-ajuda{
    background:#f8f9fa;
    border-left:4px solid #0d6efd;
    padding:12px 15px;
    border-radius:8px;
    margin-bottom:15px;
    color:#333;
}

.badge-entrada,
.badge-saida,
.badge-auto,
.badge-manual{
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
    display:inline-block;
}

.badge-entrada{ background:#d4edda; }
.badge-saida{ background:#f8d7da; }
.badge-auto{ background:#cfe2ff; margin-left:4px; }
.badge-manual{ background:#fff3cd; margin-left:4px; }

.acoes a{
    text-decoration:none;
    color:red;
}

.compra-table input,
.compra-table select{
    width:100%;
    padding:8px;
    border:1px solid #ddd;
    border-radius:8px;
}

.compra-table th,
.compra-table td{
    vertical-align:middle;
}

.aviso-box{
    border-left:5px solid #0d6efd;
}

.sucesso{
    background:#d4edda;
    padding:12px 15px;
    border-radius:8px;
    margin-bottom:20px;
}
</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1 style="margin-bottom:25px;">Financeiro</h1>

<?php if(isset($_GET['sucesso'])){ ?>
<div class="sucesso">
<?= intval($_GET['sucesso']); ?> compra(s)/despesa(s) registrada(s) com sucesso.
</div>
<?php } ?>

<div class="aviso-box">
<strong>Como funciona agora:</strong><br>
As vendas entram automaticamente quando o pedido é criado pelo bot. Aqui você registra apenas compras e despesas, como carne, frango, linguiça, carvão, embalagens e outros gastos.
</div>

<div class="dashboard">

<div class="card-info">
<h4>Vendas Automáticas</h4>
<h2 class="entrada">
R$ <?= number_format($vendasAutomaticas['total'],2,',','.'); ?>
</h2>
</div>

<div class="card-info">
<h4>Entradas Totais</h4>
<h2 class="info">
R$ <?= number_format($entradas['total'],2,',','.'); ?>
</h2>
</div>

<div class="card-info">
<h4>Compras / Saídas</h4>
<h2 class="saida">
R$ <?= number_format($saidas['total'],2,',','.'); ?>
</h2>
</div>

<div class="card-info">
<h4>Lucro</h4>
<h2 class="lucro">
R$ <?= number_format($lucro,2,',','.'); ?>
</h2>
</div>

</div>

<div class="filtro-box">

<form method="GET" class="form-grid">

<div class="form-group">
<label>Data Inicial</label>
<input type="date" name="data_inicio" value="<?= h($data_inicio); ?>">
</div>

<div class="form-group">
<label>Data Final</label>
<input type="date" name="data_fim" value="<?= h($data_fim); ?>">
</div>

<div class="form-group">
<label>&nbsp;</label>
<button class="btn-filtrar">Filtrar</button>
</div>

</form>

</div>

<div class="form-card">

<h2>Registrar Compra / Despesa</h2>
<br>

<form method="POST">

<div class="form-grid">

<div class="form-group">
<label>Data da compra</label>
<input type="date" name="data_movimento" value="<?= date('Y-m-d'); ?>" required>
</div>

<div class="form-group">
<label>Forma de Pagamento</label>
<select name="forma_pagamento">
<option value="PIX">PIX</option>
<option value="DINHEIRO">Dinheiro</option>
<option value="CARTAO">Cartão</option>
<option value="IFOOD">iFood</option>
<option value="99FOOD">99Food</option>
<option value="OUTRO">Outro</option>
</select>
</div>

<div class="form-group">
<label>Observação geral</label>
<input type="text" name="observacao" placeholder="Ex: compra no açougue, atacado, mercado...">
</div>

</div>

<datalist id="sugestoes-compras">
<option value="Carne">
<option value="Frango">
<option value="Linguiça">
<option value="Coração">
<option value="Tulipa">
<option value="Mandioca">
<option value="Farofa">
<option value="Vinagrete">
<option value="Arroz">
<option value="Carvão">
<option value="Embalagens">
<option value="Saco de papel">
<option value="Gás">
<option value="Motoboy">
<option value="Mercado">
<option value="Queijo coalho">
<option value="Bacon">
<option value="Óleo">
<option value="Tempero">
<option value="Descartáveis">
<option value="Alumínio">
<option value="Guardanapo">
<option value="Outro">
</datalist>

<h3>Itens comprados</h3>
<div class="itens-ajuda">
Digite qualquer item que você comprou. Não fica preso na lista: pode escrever Carne, Frango, Linguiça, Bacon, Queijo, Pote, Saco de papel, Gás, Mercado ou qualquer outro gasto.
</div>

<button type="button" class="btn-add" onclick="adicionarLinhaCompra()">
+ Adicionar mais item comprado
</button>

<table class="compra-table" id="tabelaCompras">
<tr>
<th>Item comprado</th>
<th>Quantidade</th>
<th>Unidade</th>
<th>Valor gasto</th>
<th></th>
</tr>

<tr>
<td><input type="text" name="item[]" list="sugestoes-compras" placeholder="Ex: Carne, frango, linguiça, bacon, gás..."></td>
<td><input type="text" name="quantidade[]" placeholder="Ex: 5"></td>
<td>
<select name="unidade[]">
<option value="kg">kg</option>
<option value="un">un</option>
<option value="pct">pct</option>
<option value="cx">cx</option>
<option value="l">l</option>
<option value="">Outro</option>
</select>
</td>
<td><input type="number" step="0.01" min="0" name="valor[]" placeholder="0,00"></td>
<td><button type="button" class="btn-remover-item" onclick="removerLinhaCompra(this)">X</button></td>
</tr>

</table>

<button type="button" class="btn-add btn-add-bottom" onclick="adicionarLinhaCompra()">
+ Adicionar outro item
</button>

<br>

<button type="submit" name="salvar_compra" class="btn-salvar">
Salvar Compra / Despesa
</button>

</form>

</div>

<div class="table-box">

<h2>Movimentações Financeiras</h2>
<br>

<table>
<tr>
<th>ID</th>
<th>Data</th>
<th>Tipo</th>
<th>Descrição</th>
<th>Pagamento</th>
<th>Valor</th>
<th>Pedido</th>
<th>Ações</th>
</tr>

<?php while($mov = $movimentacoes->fetch_assoc()){ ?>

<tr>
<td><?= h($mov['id']); ?></td>

<td><?= date('d/m/Y', strtotime($mov['data_movimento'])); ?></td>

<td>
<?php if($mov['tipo'] == 'ENTRADA'){ ?>
<span class="badge-entrada">Entrada</span>
<?php }else{ ?>
<span class="badge-saida">Saída</span>
<?php } ?>

<?php if(!empty($mov['automatico'])){ ?>
<span class="badge-auto">Automático</span>
<?php }else{ ?>
<span class="badge-manual">Manual</span>
<?php } ?>
</td>

<td><?= h($mov['descricao']); ?></td>

<td><?= h($mov['forma_pagamento']); ?></td>

<td>R$ <?= number_format($mov['valor'],2,',','.'); ?></td>

<td>
<?php if(!empty($mov['pedido_id'])){ ?>
#<?= h($mov['pedido_id']); ?>
<?php }else{ ?>
-
<?php } ?>
</td>

<td class="acoes">
<?php if(empty($mov['automatico'])){ ?>
<a href="?excluir=<?= h($mov['id']); ?>" onclick="return confirm('Excluir esta movimentação manual?')">
Excluir
</a>
<?php }else{ ?>
-
<?php } ?>
</td>
</tr>

<?php } ?>

</table>

</div>

</div>
</div>

<script>
function adicionarLinhaCompra(){
    const tabela = document.getElementById('tabelaCompras');
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td><input type="text" name="item[]" list="sugestoes-compras" placeholder="Ex: Carne, frango, linguiça, bacon, gás..."></td>
        <td><input type="text" name="quantidade[]" placeholder="Ex: 5"></td>
        <td>
            <select name="unidade[]">
                <option value="kg">kg</option>
                <option value="un">un</option>
                <option value="pct">pct</option>
                <option value="cx">cx</option>
                <option value="l">l</option>
                <option value="">Outro</option>
            </select>
        </td>
        <td><input type="number" step="0.01" min="0" name="valor[]" placeholder="0,00"></td>
        <td><button type="button" class="btn-remover-item" onclick="removerLinhaCompra(this)">X</button></td>
    `;

    tabela.appendChild(tr);
}

function removerLinhaCompra(botao){
    const tr = botao.closest('tr');
    if(tr){
        tr.remove();
    }
}
</script>

</body>
</html>
