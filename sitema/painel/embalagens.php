<?php

session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

function h($valor){
    return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
}

function usuarioPodeVerEmbalagens(){
    $usuarioId = intval($_SESSION['usuario_id'] ?? 0);
    $usuario = strtolower(trim((string)($_SESSION['usuario'] ?? '')));
    $nome = strtolower(trim((string)($_SESSION['nome'] ?? '')));

    return $usuarioId === 3 || $usuario === 'marcelo' || $nome === 'marcelo';
}

function telaAcessoNegado(){
    ?>
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
        <meta charset="UTF-8">
        <title>Acesso negado</title>
        <link rel="stylesheet" href="assets/css/style.css">
        <style>
        .box-negado{
            background:#fff;
            max-width:650px;
            margin:40px auto;
            padding:35px;
            border-radius:18px;
            box-shadow:0 3px 15px rgba(0,0,0,.08);
            text-align:center;
        }
        .box-negado h1{ color:#dc3545; margin-bottom:10px; }
        .box-negado a{
            background:#ff6b00;
            color:#fff;
            padding:12px 20px;
            border-radius:8px;
            text-decoration:none;
            display:inline-block;
            margin-top:15px;
        }
        </style>
    </head>
    <body>
    <?php include 'includes/sidebar.php'; ?>
    <div class="main">
    <?php include 'includes/topbar.php'; ?>
    <div class="content">
        <div class="box-negado">
            <h1>🔒 Acesso negado</h1>
            <p>Esta área de embalagens é restrita ao usuário autorizado.</p>
            <a href="dashboard.php">Voltar</a>
        </div>
    </div>
    </div>
    </body>
    </html>
    <?php
    exit;
}

function garantirTabelasEmbalagens($conn){

    $conn->query("CREATE TABLE IF NOT EXISTS embalagens (
        id INT(11) NOT NULL AUTO_INCREMENT,
        nome VARCHAR(120) NOT NULL,
        descricao TEXT DEFAULT NULL,
        unidade VARCHAR(30) DEFAULT 'un',
        estoque INT(11) NOT NULL DEFAULT 0,
        estoque_minimo INT(11) NOT NULL DEFAULT 10,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("CREATE TABLE IF NOT EXISTS embalagem_movimentacoes (
        id INT(11) NOT NULL AUTO_INCREMENT,
        embalagem_id INT(11) NOT NULL,
        tipo ENUM('ENTRADA','SAIDA','AJUSTE') NOT NULL,
        quantidade INT(11) NOT NULL,
        observacao TEXT DEFAULT NULL,
        criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY embalagem_id (embalagem_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("CREATE TABLE IF NOT EXISTS produto_embalagens (
        id INT(11) NOT NULL AUTO_INCREMENT,
        produto_id INT(11) NOT NULL,
        embalagem_id INT(11) NOT NULL,
        quantidade INT(11) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY produto_embalagem_unica (produto_id, embalagem_id),
        KEY produto_id (produto_id),
        KEY embalagem_id (embalagem_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");

    $conn->query("CREATE TABLE IF NOT EXISTS pedido_embalagens_padrao (
        id INT(11) NOT NULL AUTO_INCREMENT,
        embalagem_id INT(11) NOT NULL,
        quantidade INT(11) NOT NULL DEFAULT 1,
        ativo TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY embalagem_pedido_unica (embalagem_id),
        KEY embalagem_id (embalagem_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci");
}

if(!usuarioPodeVerEmbalagens()){
    telaAcessoNegado();
}

garantirTabelasEmbalagens($conn);

/*
|--------------------------------------------------------------------------
| AÇÕES
|--------------------------------------------------------------------------
*/

if(isset($_POST['salvar_embalagem'])){

    $nome = $conn->real_escape_string($_POST['nome_embalagem'] ?? '');
    $descricao = $conn->real_escape_string($_POST['descricao_embalagem'] ?? '');
    $unidade = $conn->real_escape_string($_POST['unidade_embalagem'] ?? 'un');
    $estoque = intval($_POST['estoque_embalagem'] ?? 0);
    $estoqueMinimo = intval($_POST['estoque_minimo_embalagem'] ?? 10);
    $ativo = isset($_POST['ativo_embalagem']) ? 1 : 0;

    if(trim($nome) !== ''){
        $conn->query("INSERT INTO embalagens
        (nome, descricao, unidade, estoque, estoque_minimo, ativo)
        VALUES
        ('$nome', '$descricao', '$unidade', '$estoque', '$estoqueMinimo', '$ativo')");

        $embalagemId = $conn->insert_id;

        if($estoque > 0){
            $conn->query("INSERT INTO embalagem_movimentacoes
            (embalagem_id, tipo, quantidade, observacao)
            VALUES
            ('$embalagemId', 'ENTRADA', '$estoque', 'Cadastro inicial da embalagem')");
        }
    }

    header("Location: embalagens.php");
    exit;
}

if(isset($_POST['movimentar_embalagem'])){

    $embalagemId = intval($_POST['embalagem_id'] ?? 0);
    $tipo = $_POST['tipo_movimentacao'] ?? 'ENTRADA';
    $quantidade = intval($_POST['quantidade_movimentacao'] ?? 0);
    $observacao = $conn->real_escape_string($_POST['observacao_movimentacao'] ?? '');
    $permitidos = ['ENTRADA','SAIDA','AJUSTE'];

    if($embalagemId > 0 && $quantidade >= 0 && in_array($tipo, $permitidos)){

        $emb = $conn->query("SELECT estoque FROM embalagens WHERE id='$embalagemId' LIMIT 1")->fetch_assoc();

        if($emb){
            $estoqueAtual = intval($emb['estoque']);

            if($tipo === 'ENTRADA'){
                $novoEstoque = $estoqueAtual + $quantidade;
            }elseif($tipo === 'SAIDA'){
                $novoEstoque = max(0, $estoqueAtual - $quantidade);
            }else{
                $novoEstoque = $quantidade;
            }

            $conn->query("UPDATE embalagens SET estoque='$novoEstoque' WHERE id='$embalagemId'");
            $conn->query("INSERT INTO embalagem_movimentacoes
            (embalagem_id, tipo, quantidade, observacao)
            VALUES
            ('$embalagemId', '$tipo', '$quantidade', '$observacao')");
        }
    }

    header("Location: embalagens.php");
    exit;
}

if(isset($_POST['vincular_produto_embalagem'])){

    $produtoId = intval($_POST['produto_id_embalagem'] ?? 0);
    $embalagemId = intval($_POST['embalagem_id_produto'] ?? 0);
    $quantidade = max(1, intval($_POST['quantidade_por_produto'] ?? 1));

    if($produtoId > 0 && $embalagemId > 0){
        $conn->query("INSERT INTO produto_embalagens
        (produto_id, embalagem_id, quantidade)
        VALUES
        ('$produtoId', '$embalagemId', '$quantidade')
        ON DUPLICATE KEY UPDATE quantidade=VALUES(quantidade)");
    }

    header("Location: embalagens.php#vinculos");
    exit;
}

if(isset($_POST['vincular_embalagem_pedido'])){

    $embalagemId = intval($_POST['embalagem_id_pedido'] ?? 0);
    $quantidade = max(1, intval($_POST['quantidade_por_pedido'] ?? 1));
    $ativo = isset($_POST['ativo_pedido_embalagem']) ? 1 : 0;

    if($embalagemId > 0){
        $conn->query("INSERT INTO pedido_embalagens_padrao
        (embalagem_id, quantidade, ativo)
        VALUES
        ('$embalagemId', '$quantidade', '$ativo')
        ON DUPLICATE KEY UPDATE quantidade=VALUES(quantidade), ativo=VALUES(ativo)");
    }

    header("Location: embalagens.php#vinculos");
    exit;
}

if(isset($_GET['remover_produto_embalagem'])){
    $id = intval($_GET['remover_produto_embalagem']);
    $conn->query("DELETE FROM produto_embalagens WHERE id='$id'");
    header("Location: embalagens.php#vinculos");
    exit;
}

if(isset($_GET['remover_embalagem_pedido'])){
    $id = intval($_GET['remover_embalagem_pedido']);
    $conn->query("DELETE FROM pedido_embalagens_padrao WHERE id='$id'");
    header("Location: embalagens.php#vinculos");
    exit;
}

if(isset($_GET['excluir_embalagem'])){
    $id = intval($_GET['excluir_embalagem']);
    $conn->query("DELETE FROM produto_embalagens WHERE embalagem_id='$id'");
    $conn->query("DELETE FROM pedido_embalagens_padrao WHERE embalagem_id='$id'");
    $conn->query("DELETE FROM embalagem_movimentacoes WHERE embalagem_id='$id'");
    $conn->query("DELETE FROM embalagens WHERE id='$id'");
    header("Location: embalagens.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| CONSULTAS
|--------------------------------------------------------------------------
*/

$totalEmbalagens = $conn->query("SELECT COUNT(*) total FROM embalagens")->fetch_assoc();
$estoqueBaixo = $conn->query("SELECT COUNT(*) total FROM embalagens WHERE estoque <= estoque_minimo AND estoque > 0")->fetch_assoc();
$esgotadas = $conn->query("SELECT COUNT(*) total FROM embalagens WHERE estoque <= 0")->fetch_assoc();

$produtosSelect = $conn->query("SELECT id, nome FROM produtos ORDER BY nome ASC");
$embalagensSelectProduto = $conn->query("SELECT id, nome, estoque, unidade FROM embalagens WHERE ativo=1 ORDER BY nome ASC");
$embalagensSelectPedido = $conn->query("SELECT id, nome, estoque, unidade FROM embalagens WHERE ativo=1 ORDER BY nome ASC");
$embalagensSelectMov = $conn->query("SELECT id, nome, estoque, unidade FROM embalagens ORDER BY nome ASC");

$embalagens = $conn->query("SELECT * FROM embalagens ORDER BY estoque ASC, nome ASC");

$vinculosProduto = $conn->query("
SELECT pe.id, pe.quantidade, p.nome produto, e.nome embalagem, e.unidade
FROM produto_embalagens pe
LEFT JOIN produtos p ON p.id = pe.produto_id
LEFT JOIN embalagens e ON e.id = pe.embalagem_id
ORDER BY p.nome ASC, e.nome ASC
");

$vinculosPedido = $conn->query("
SELECT pep.id, pep.quantidade, pep.ativo, e.nome embalagem, e.unidade
FROM pedido_embalagens_padrao pep
LEFT JOIN embalagens e ON e.id = pep.embalagem_id
ORDER BY e.nome ASC
");

$movimentacoesEmbalagens = $conn->query("
SELECT em.*, e.nome embalagem, e.unidade
FROM embalagem_movimentacoes em
LEFT JOIN embalagens e ON e.id = em.embalagem_id
ORDER BY em.id DESC
LIMIT 25
");

?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Embalagens</title>
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
.table-box{
    background:#fff;
    padding:25px;
    border-radius:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
    margin-bottom:25px;
}

.form-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
    gap:15px;
}

.form-group{ margin-bottom:15px; }
.form-group label{ display:block; margin-bottom:5px; font-weight:bold; }

.form-group input,
.form-group select,
.form-group textarea{
    width:100%;
    padding:10px;
    border:1px solid #ddd;
    border-radius:8px;
}

.btn-salvar{
    background:#6f42c1;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}

.btn-excluir{
    background:#dc3545;
    color:#fff;
    text-decoration:none;
    padding:7px 11px;
    border-radius:5px;
    display:inline-block;
}

.badge-ok,
.badge-baixo,
.badge-zero,
.badge-ativo,
.badge-inativo{
    display:inline-block;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
    margin:2px;
}
.badge-ok{ background:#d4edda; }
.badge-baixo{ background:#fff3cd; }
.badge-zero{ background:#f8d7da; }
.badge-ativo{ background:#d4edda; }
.badge-inativo{ background:#f8d7da; }

.alerta{
    background:#fff3cd;
    border:1px solid #ffeeba;
    padding:12px;
    border-radius:8px;
    margin-bottom:15px;
}

.grid-2{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(320px,1fr));
    gap:20px;
}

table{ width:100%; border-collapse:collapse; }
th,td{ padding:10px; border-bottom:1px solid #eee; text-align:left; vertical-align:top; }
th{ background:#f8f9fa; }
</style>
</head>
<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">
<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1 style="margin-bottom:25px;">📦 Embalagens</h1>

<div class="alerta">
<strong>Área restrita.</strong> Aqui você controla embalagem de espetinho, potes de mandioca, farofa, vinagrete, arroz, saco de papel e outros itens usados nos pedidos. Quando o pedido é criado, o sistema baixa automaticamente as embalagens configuradas.
</div>

<div class="dashboard">
    <div class="card-info">
        <h4>Total de Embalagens</h4>
        <h2><?=h($totalEmbalagens['total'] ?? 0)?></h2>
    </div>
    <div class="card-info">
        <h4>Estoque Baixo</h4>
        <h2><?=h($estoqueBaixo['total'] ?? 0)?></h2>
    </div>
    <div class="card-info">
        <h4>Esgotadas</h4>
        <h2><?=h($esgotadas['total'] ?? 0)?></h2>
    </div>
</div>

<div class="grid-2">

<div class="form-card">
<h2>Nova Embalagem</h2>
<br>
<form method="POST">
    <div class="form-group">
        <label>Nome</label>
        <input type="text" name="nome_embalagem" placeholder="Ex: Embalagem para espetinho" required>
    </div>
    <div class="form-group">
        <label>Descrição</label>
        <textarea name="descricao_embalagem" rows="2" placeholder="Opcional"></textarea>
    </div>
    <div class="form-grid">
        <div class="form-group">
            <label>Unidade</label>
            <input type="text" name="unidade_embalagem" value="un" placeholder="un, pote, saco...">
        </div>
        <div class="form-group">
            <label>Estoque inicial</label>
            <input type="number" name="estoque_embalagem" min="0" value="0">
        </div>
        <div class="form-group">
            <label>Estoque mínimo</label>
            <input type="number" name="estoque_minimo_embalagem" min="0" value="10">
        </div>
    </div>
    <label><input type="checkbox" name="ativo_embalagem" checked> Embalagem ativa</label>
    <br><br>
    <button type="submit" name="salvar_embalagem" class="btn-salvar">Salvar Embalagem</button>
</form>
</div>

<div class="form-card">
<h2>Movimentar Estoque</h2>
<br>
<form method="POST">
    <div class="form-group">
        <label>Embalagem</label>
        <select name="embalagem_id" required>
            <option value="">Selecione</option>
            <?php while($e = $embalagensSelectMov->fetch_assoc()){ ?>
            <option value="<?=h($e['id'])?>"><?=h($e['nome'])?> - atual: <?=h($e['estoque'])?> <?=h($e['unidade'])?></option>
            <?php } ?>
        </select>
    </div>
    <div class="form-grid">
        <div class="form-group">
            <label>Tipo</label>
            <select name="tipo_movimentacao" required>
                <option value="ENTRADA">Entrada</option>
                <option value="SAIDA">Saída</option>
                <option value="AJUSTE">Ajuste Manual</option>
            </select>
        </div>
        <div class="form-group">
            <label>Quantidade</label>
            <input type="number" name="quantidade_movimentacao" min="0" required>
        </div>
    </div>
    <div class="form-group">
        <label>Observação</label>
        <textarea name="observacao_movimentacao" rows="2" placeholder="Ex: compra de potes, perda, ajuste..."></textarea>
    </div>
    <button type="submit" name="movimentar_embalagem" class="btn-salvar">Salvar Movimentação</button>
</form>
</div>

</div>

<div class="grid-2" id="vinculos">

<div class="form-card">
<h2>Embalagem usada por Produto</h2>
<p style="color:#555;margin:8px 0 15px;">Exemplo: Espetinho usa 1 embalagem. Marmita ou acompanhamento usa 1 pote.</p>
<form method="POST">
    <div class="form-group">
        <label>Produto vendido</label>
        <select name="produto_id_embalagem" required>
            <option value="">Selecione</option>
            <?php while($p = $produtosSelect->fetch_assoc()){ ?>
            <option value="<?=h($p['id'])?>"><?=h($p['nome'])?></option>
            <?php } ?>
        </select>
    </div>
    <div class="form-group">
        <label>Embalagem</label>
        <select name="embalagem_id_produto" required>
            <option value="">Selecione</option>
            <?php while($e = $embalagensSelectProduto->fetch_assoc()){ ?>
            <option value="<?=h($e['id'])?>"><?=h($e['nome'])?> - estoque: <?=h($e['estoque'])?> <?=h($e['unidade'])?></option>
            <?php } ?>
        </select>
    </div>
    <div class="form-group">
        <label>Quantidade usada por unidade vendida</label>
        <input type="number" name="quantidade_por_produto" min="1" value="1" required>
    </div>
    <button type="submit" name="vincular_produto_embalagem" class="btn-salvar">Vincular ao Produto</button>
</form>
</div>

<div class="form-card">
<h2>Embalagem padrão do Pedido</h2>
<p style="color:#555;margin:8px 0 15px;">Use para saco de papel, sacola ou item usado uma vez por pedido.</p>
<form method="POST">
    <div class="form-group">
        <label>Embalagem</label>
        <select name="embalagem_id_pedido" required>
            <option value="">Selecione</option>
            <?php while($e = $embalagensSelectPedido->fetch_assoc()){ ?>
            <option value="<?=h($e['id'])?>"><?=h($e['nome'])?> - estoque: <?=h($e['estoque'])?> <?=h($e['unidade'])?></option>
            <?php } ?>
        </select>
    </div>
    <div class="form-group">
        <label>Quantidade usada por pedido</label>
        <input type="number" name="quantidade_por_pedido" min="1" value="1" required>
    </div>
    <label><input type="checkbox" name="ativo_pedido_embalagem" checked> Ativa para todos os pedidos</label>
    <br><br>
    <button type="submit" name="vincular_embalagem_pedido" class="btn-salvar">Salvar Padrão</button>
</form>
</div>

</div>

<div class="table-box">
<h2>Estoque de Embalagens</h2>
<br>
<table>
<tr>
<th>ID</th>
<th>Embalagem</th>
<th>Estoque</th>
<th>Status</th>
<th>Ações</th>
</tr>
<?php while($emb = $embalagens->fetch_assoc()){ ?>
<tr>
<td><?=h($emb['id'])?></td>
<td><strong><?=h($emb['nome'])?></strong><br><small><?=h($emb['descricao'])?></small></td>
<td><?=h($emb['estoque'])?> <?=h($emb['unidade'])?></td>
<td>
<?php if(intval($emb['estoque']) <= 0){ ?>
<span class="badge-zero">Esgotada</span>
<?php }elseif(intval($emb['estoque']) <= intval($emb['estoque_minimo'])){ ?>
<span class="badge-baixo">Baixo</span>
<?php }else{ ?>
<span class="badge-ok">OK</span>
<?php } ?>
<?= intval($emb['ativo']) ? '<span class="badge-ativo">Ativa</span>' : '<span class="badge-inativo">Inativa</span>' ?>
</td>
<td><a class="btn-excluir" href="?excluir_embalagem=<?=h($emb['id'])?>" onclick="return confirm('Excluir esta embalagem?')">Excluir</a></td>
</tr>
<?php } ?>
</table>
</div>

<div class="grid-2">
<div class="table-box">
<h2>Vínculos por Produto</h2>
<br>
<table>
<tr>
<th>Produto</th>
<th>Embalagem</th>
<th>Qtd</th>
<th>Ação</th>
</tr>
<?php while($v = $vinculosProduto->fetch_assoc()){ ?>
<tr>
<td><?=h($v['produto'])?></td>
<td><?=h($v['embalagem'])?></td>
<td><?=h($v['quantidade'])?> <?=h($v['unidade'])?></td>
<td><a class="btn-excluir" href="?remover_produto_embalagem=<?=h($v['id'])?>" onclick="return confirm('Remover vínculo?')">Remover</a></td>
</tr>
<?php } ?>
</table>
</div>

<div class="table-box">
<h2>Embalagens por Pedido</h2>
<br>
<table>
<tr>
<th>Embalagem</th>
<th>Qtd</th>
<th>Status</th>
<th>Ação</th>
</tr>
<?php while($v = $vinculosPedido->fetch_assoc()){ ?>
<tr>
<td><?=h($v['embalagem'])?></td>
<td><?=h($v['quantidade'])?> <?=h($v['unidade'])?></td>
<td><?= intval($v['ativo']) ? '<span class="badge-ativo">Ativa</span>' : '<span class="badge-inativo">Inativa</span>' ?></td>
<td><a class="btn-excluir" href="?remover_embalagem_pedido=<?=h($v['id'])?>" onclick="return confirm('Remover embalagem padrão?')">Remover</a></td>
</tr>
<?php } ?>
</table>
</div>
</div>

<div class="table-box">
<h2>Últimas Movimentações de Embalagens</h2>
<br>
<table>
<tr>
<th>Data</th>
<th>Embalagem</th>
<th>Tipo</th>
<th>Quantidade</th>
<th>Observação</th>
</tr>
<?php while($m = $movimentacoesEmbalagens->fetch_assoc()){ ?>
<tr>
<td><?=date('d/m/Y H:i', strtotime($m['criado_em']))?></td>
<td><?=h($m['embalagem'])?></td>
<td><?=h($m['tipo'])?></td>
<td><?=h($m['quantidade'])?> <?=h($m['unidade'])?></td>
<td><?=h($m['observacao'])?></td>
</tr>
<?php } ?>
</table>
</div>

</div>
</div>
</body>
</html>
