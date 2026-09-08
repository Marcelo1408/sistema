<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(isset($_POST['salvar'])){

    $produto_id = intval($_POST['produto_id']);
    $tipo = $_POST['tipo'];
    $quantidade = intval($_POST['quantidade']);
    $observacao = $conn->real_escape_string($_POST['observacao']);

    $produto = $conn->query("
    SELECT estoque
    FROM produtos
    WHERE id='$produto_id'
    ")->fetch_assoc();

    if($produto){

        $estoqueAtual = intval($produto['estoque']);

        if($tipo == 'ENTRADA'){
            $novoEstoque = $estoqueAtual + $quantidade;
        }elseif($tipo == 'SAIDA'){
            $novoEstoque = $estoqueAtual - $quantidade;
            if($novoEstoque < 0){
                $novoEstoque = 0;
            }
        }else{
            $novoEstoque = $quantidade;
        }

        $conn->query("
        UPDATE produtos
        SET estoque='$novoEstoque'
        WHERE id='$produto_id'
        ");

        $conn->query("
        INSERT INTO estoque_movimentacoes
        (produto_id,tipo,quantidade,observacao)
        VALUES
        ('$produto_id','$tipo','$quantidade','$observacao')
        ");
    }

    header("Location: estoque.php");
    exit;
}

$produtos = $conn->query("
SELECT
p.*,
c.nome categoria
FROM produtos p
LEFT JOIN categorias c
ON c.id=p.categoria_id
ORDER BY p.estoque ASC
");

$produtosSelect = $conn->query("
SELECT id,nome,estoque
FROM produtos
ORDER BY nome ASC
");

$totalProdutos = $conn->query("
SELECT COUNT(*) total
FROM produtos
")->fetch_assoc();

$estoqueBaixo = $conn->query("
SELECT COUNT(*) total
FROM produtos
WHERE estoque <= 10
")->fetch_assoc();

$esgotados = $conn->query("
SELECT COUNT(*) total
FROM produtos
WHERE estoque = 0
")->fetch_assoc();

$movimentacoes = $conn->query("
SELECT
em.*,
p.nome produto
FROM estoque_movimentacoes em
LEFT JOIN produtos p
ON p.id=em.produto_id
ORDER BY em.id DESC
LIMIT 20
");

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Estoque</title>
<link rel="stylesheet" href="assets/css/style.css">

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

.badge-ok{
    background:#d4edda;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.badge-baixo{
    background:#fff3cd;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.badge-zero{
    background:#f8d7da;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}
</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1 style="margin-bottom:25px;">Estoque</h1>

<div class="dashboard">

<div class="card-info">
<h4>Total de Produtos</h4>
<h2><?= $totalProdutos['total']; ?></h2>
</div>

<div class="card-info">
<h4>Estoque Baixo</h4>
<h2><?= $estoqueBaixo['total']; ?></h2>
</div>

<div class="card-info">
<h4>Esgotados</h4>
<h2><?= $esgotados['total']; ?></h2>
</div>

</div>

<div class="form-card">

<h2>Movimentar Estoque</h2>
<br>

<form method="POST">

<div class="form-grid">

<div class="form-group">
<label>Produto</label>
<select name="produto_id" required>
<option value="">Selecione</option>

<?php while($p = $produtosSelect->fetch_assoc()){ ?>

<option value="<?= $p['id']; ?>">
<?= $p['nome']; ?> - atual: <?= $p['estoque']; ?>
</option>

<?php } ?>

</select>
</div>

<div class="form-group">
<label>Tipo</label>
<select name="tipo" required>
<option value="ENTRADA">Entrada</option>
<option value="SAIDA">Saída</option>
<option value="AJUSTE">Ajuste Manual</option>
</select>
</div>

<div class="form-group">
<label>Quantidade</label>
<input type="number" name="quantidade" min="0" required>
</div>

</div>

<div class="form-group">
<label>Observação</label>
<textarea name="observacao" rows="2" placeholder="Ex: compra de espetos, perda, ajuste de contagem..."></textarea>
</div>

<button type="submit" name="salvar" class="btn-salvar">
Salvar Movimentação
</button>

</form>

</div>

<div class="table-box">

<h2>Produtos em Estoque</h2>
<br>

<table>

<tr>
<th>ID</th>
<th>Produto</th>
<th>Categoria</th>
<th>Estoque</th>
<th>Status</th>
</tr>

<?php while($produto = $produtos->fetch_assoc()){ ?>

<tr>

<td><?= $produto['id']; ?></td>

<td><?= $produto['nome']; ?></td>

<td><?= $produto['categoria']; ?></td>

<td><?= $produto['estoque']; ?></td>

<td>
<?php if($produto['estoque'] == 0){ ?>

<span class="badge-zero">Esgotado</span>

<?php }elseif($produto['estoque'] <= 10){ ?>

<span class="badge-baixo">Baixo</span>

<?php }else{ ?>

<span class="badge-ok">OK</span>

<?php } ?>
</td>

</tr>

<?php } ?>

</table>

</div>

<div class="table-box">

<h2>Últimas Movimentações</h2>
<br>

<table>

<tr>
<th>Data</th>
<th>Produto</th>
<th>Tipo</th>
<th>Quantidade</th>
<th>Observação</th>
</tr>

<?php while($mov = $movimentacoes->fetch_assoc()){ ?>

<tr>

<td><?= date('d/m/Y H:i', strtotime($mov['criado_em'])); ?></td>

<td><?= $mov['produto']; ?></td>

<td><?= $mov['tipo']; ?></td>

<td><?= $mov['quantidade']; ?></td>

<td><?= $mov['observacao']; ?></td>

</tr>

<?php } ?>

</table>

</div>

</div>

</div>

</body>
</html>