<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(isset($_POST['salvar'])){

    $nome = $conn->real_escape_string($_POST['nome']);
    $descricao = $conn->real_escape_string($_POST['descricao']);
    $preco = $conn->real_escape_string($_POST['preco']);
    $destaque = isset($_POST['destaque']) ? 1 : 0;
    $ativo = isset($_POST['ativo']) ? 1 : 0;

    $imagem = "";

    if(isset($_FILES['imagem']) && $_FILES['imagem']['error'] == 0){

        $pasta = "uploads/";

        if(!is_dir($pasta)){
            mkdir($pasta, 0777, true);
        }

        $ext = strtolower(pathinfo($_FILES['imagem']['name'], PATHINFO_EXTENSION));
        $permitidas = ['jpg','jpeg','png','webp'];

        if(in_array($ext, $permitidas)){
            $imagem = "combo_" . time() . "." . $ext;

            move_uploaded_file(
                $_FILES['imagem']['tmp_name'],
                $pasta . $imagem
            );
        }
    }

    $conn->query("
    INSERT INTO combos
    (nome, descricao, preco, imagem, destaque, ativo)
    VALUES
    ('$nome', '$descricao', '$preco', '$imagem', '$destaque', '$ativo')
    ");

    $combo_id = $conn->insert_id;

    if(isset($_POST['produto_id'])){

        foreach($_POST['produto_id'] as $i => $produto_id){

            $produto_id = intval($produto_id);
            $quantidade = intval($_POST['quantidade'][$i]);

            if($produto_id > 0 && $quantidade > 0){

                $conn->query("
                INSERT INTO combo_produtos
                (combo_id, produto_id, quantidade)
                VALUES
                ('$combo_id', '$produto_id', '$quantidade')
                ");
            }
        }
    }

    header("Location: combos.php");
    exit;
}

if(isset($_GET['acao']) && isset($_GET['id'])){

    $id = intval($_GET['id']);

    if($_GET['acao'] == 'ativar'){
        $conn->query("UPDATE combos SET ativo=1 WHERE id='$id'");
    }

    if($_GET['acao'] == 'desativar'){
        $conn->query("UPDATE combos SET ativo=0 WHERE id='$id'");
    }

    if($_GET['acao'] == 'destaque_on'){
        $conn->query("UPDATE combos SET destaque=1 WHERE id='$id'");
    }

    if($_GET['acao'] == 'destaque_off'){
        $conn->query("UPDATE combos SET destaque=0 WHERE id='$id'");
    }

    header("Location: combos.php");
    exit;
}

if(isset($_GET['excluir'])){

    $id = intval($_GET['excluir']);

    $conn->query("DELETE FROM combo_produtos WHERE combo_id='$id'");
    $conn->query("DELETE FROM combos WHERE id='$id'");

    header("Location: combos.php");
    exit;
}

$produtos = $conn->query("
SELECT id, nome, preco
FROM produtos
WHERE ativo=1
ORDER BY nome ASC
");

$combos = $conn->query("
SELECT *
FROM combos
ORDER BY id DESC
");

$totalCombos = $conn->query("
SELECT COUNT(*) total
FROM combos
")->fetch_assoc();

$combosAtivos = $conn->query("
SELECT COUNT(*) total
FROM combos
WHERE ativo=1
")->fetch_assoc();

$combosDestaque = $conn->query("
SELECT COUNT(*) total
FROM combos
WHERE destaque=1
")->fetch_assoc();

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Combos</title>
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
.form-group textarea,
.form-group select{
    width:100%;
    padding:10px;
    border:1px solid #ddd;
    border-radius:8px;
}

.item-produto{
    display:grid;
    grid-template-columns:1fr 120px 80px;
    gap:10px;
    margin-bottom:10px;
}

.btn-salvar{
    background:#198754;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}

.btn-add{
    background:#ff6b00;
    color:#fff;
    border:none;
    padding:10px 15px;
    border-radius:8px;
    cursor:pointer;
    margin-bottom:15px;
}

.btn-remove{
    background:#dc3545;
    color:#fff;
    border:none;
    border-radius:8px;
    cursor:pointer;
}

.badge-ativo{
    background:#d4edda;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.badge-inativo{
    background:#f8d7da;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.badge-destaque{
    background:#fff3cd;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.combo-img{
    width:90px;
    height:65px;
    object-fit:cover;
    border-radius:8px;
}

.acoes a{
    text-decoration:none;
    margin-right:8px;
    font-size:13px;
}
</style>

<script>
function adicionarProduto(){
    const container = document.getElementById('produtos-combo');
    const item = document.querySelector('.item-produto').cloneNode(true);

    item.querySelector('select').value = '';
    item.querySelector('input').value = 1;

    container.appendChild(item);
}

function removerProduto(botao){
    const container = document.getElementById('produtos-combo');

    if(container.children.length > 1){
        botao.parentElement.remove();
    }
}
</script>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1 style="margin-bottom:25px;">Combos</h1>

<div class="dashboard">

<div class="card-info">
<h4>Total de Combos</h4>
<h2><?= $totalCombos['total']; ?></h2>
</div>

<div class="card-info">
<h4>Combos Ativos</h4>
<h2><?= $combosAtivos['total']; ?></h2>
</div>

<div class="card-info">
<h4>Combos em Destaque</h4>
<h2><?= $combosDestaque['total']; ?></h2>
</div>

</div>

<div class="form-card">

<h2>Novo Combo</h2>
<br>

<form method="POST" enctype="multipart/form-data">

<div class="form-grid">

<div class="form-group">
<label>Nome do Combo</label>
<input type="text" name="nome" required placeholder="Ex: Combo Família">
</div>

<div class="form-group">
<label>Preço do Combo</label>
<input type="number" step="0.01" name="preco" required>
</div>

</div>

<div class="form-group">
<label>Descrição</label>
<textarea name="descricao" rows="3" placeholder="Ex: 10 espetos + 1 coca 2L + porção"></textarea>
</div>

<div class="form-group">
<label>Imagem do Combo</label>
<input type="file" name="imagem" accept="image/*">
</div>

<h3>Produtos do Combo</h3>
<br>

<div id="produtos-combo">

<div class="item-produto">

<select name="produto_id[]">
<option value="">Selecione um produto</option>

<?php
$produtos->data_seek(0);
while($produto = $produtos->fetch_assoc()){
?>

<option value="<?= $produto['id']; ?>">
<?= $produto['nome']; ?> - R$ <?= number_format($produto['preco'],2,',','.'); ?>
</option>

<?php } ?>

</select>

<input type="number" name="quantidade[]" value="1" min="1">

<button type="button" class="btn-remove" onclick="removerProduto(this)">
X
</button>

</div>

</div>

<button type="button" class="btn-add" onclick="adicionarProduto()">
+ Adicionar Produto
</button>

<br><br>

<label>
<input type="checkbox" name="destaque">
Combo em Destaque
</label>

<br><br>

<label>
<input type="checkbox" name="ativo" checked>
Combo Ativo
</label>

<br><br>

<button type="submit" name="salvar" class="btn-salvar">
Salvar Combo
</button>

</form>

</div>

<div class="table-box">

<h2>Combos Cadastrados</h2>
<br>

<table>

<tr>
<th>ID</th>
<th>Imagem</th>
<th>Combo</th>
<th>Preço</th>
<th>Itens</th>
<th>Status</th>
<th>Destaque</th>
<th>Ações</th>
</tr>

<?php while($combo = $combos->fetch_assoc()){ ?>

<?php
$itens = $conn->query("
SELECT
cp.quantidade,
p.nome

FROM combo_produtos cp

LEFT JOIN produtos p
ON p.id = cp.produto_id

WHERE cp.combo_id='{$combo['id']}'
");
?>

<tr>

<td><?= $combo['id']; ?></td>

<td>
<?php if(!empty($combo['imagem'])){ ?>
<img src="uploads/<?= $combo['imagem']; ?>" class="combo-img">
<?php }else{ ?>
Sem imagem
<?php } ?>
</td>

<td>
<strong><?= $combo['nome']; ?></strong>
<br>
<small><?= $combo['descricao']; ?></small>
</td>

<td>
R$ <?= number_format($combo['preco'],2,',','.'); ?>
</td>

<td>
<?php while($item = $itens->fetch_assoc()){ ?>
<?= $item['quantidade']; ?>x <?= $item['nome']; ?><br>
<?php } ?>
</td>

<td>
<?php if($combo['ativo']){ ?>
<span class="badge-ativo">Ativo</span>
<?php }else{ ?>
<span class="badge-inativo">Inativo</span>
<?php } ?>
</td>

<td>
<?php if($combo['destaque']){ ?>
<span class="badge-destaque">Destaque</span>
<?php }else{ ?>
---
<?php } ?>
</td>

<td class="acoes">

<?php if($combo['ativo']){ ?>

<a href="?acao=desativar&id=<?= $combo['id']; ?>" style="color:red;">
Desativar
</a>

<?php }else{ ?>

<a href="?acao=ativar&id=<?= $combo['id']; ?>" style="color:green;">
Ativar
</a>

<?php } ?>

<?php if($combo['destaque']){ ?>

<a href="?acao=destaque_off&id=<?= $combo['id']; ?>">
Remover destaque
</a>

<?php }else{ ?>

<a href="?acao=destaque_on&id=<?= $combo['id']; ?>">
Destacar
</a>

<?php } ?>

<a
href="?excluir=<?= $combo['id']; ?>"
style="color:red;"
onclick="return confirm('Excluir este combo?')">

Excluir

</a>

</td>

</tr>

<?php } ?>

</table>

</div>

</div>

</div>

</body>
</html>