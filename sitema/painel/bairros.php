<?php


session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

/*
|--------------------------------------------------------------------------
| SALVAR / EDITAR
|--------------------------------------------------------------------------
*/

if(isset($_POST['salvar'])){

    $id = isset($_POST['id']) ? intval($_POST['id']) : 0;

    $nome = $conn->real_escape_string($_POST['nome']);
    $taxa = $conn->real_escape_string($_POST['taxa']);
    $tempo_entrega = intval($_POST['tempo_entrega']);
    $pedido_minimo = $conn->real_escape_string($_POST['pedido_minimo']);
    $entrega_disponivel = isset($_POST['entrega_disponivel']) ? 1 : 0;
    $ativo = isset($_POST['ativo']) ? 1 : 0;

    if($id > 0){

        $conn->query("
        UPDATE bairros SET
        nome='$nome',
        taxa='$taxa',
        tempo_entrega='$tempo_entrega',
        pedido_minimo='$pedido_minimo',
        entrega_disponivel='$entrega_disponivel',
        ativo='$ativo'
        WHERE id='$id'
        ");

    }else{

        $conn->query("
        INSERT INTO bairros
        (
            nome,
            taxa,
            tempo_entrega,
            pedido_minimo,
            entrega_disponivel,
            ativo
        )
        VALUES
        (
            '$nome',
            '$taxa',
            '$tempo_entrega',
            '$pedido_minimo',
            '$entrega_disponivel',
            '$ativo'
        )
        ");
    }

    header("Location: bairros.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| ATIVAR / DESATIVAR / ENTREGA
|--------------------------------------------------------------------------
*/

if(isset($_GET['acao']) && isset($_GET['id'])){

    $id = intval($_GET['id']);

    if($_GET['acao'] == 'ativar'){
        $conn->query("UPDATE bairros SET ativo=1 WHERE id='$id'");
    }

    if($_GET['acao'] == 'desativar'){
        $conn->query("UPDATE bairros SET ativo=0 WHERE id='$id'");
    }

    if($_GET['acao'] == 'entrega_on'){
        $conn->query("UPDATE bairros SET entrega_disponivel=1 WHERE id='$id'");
    }

    if($_GET['acao'] == 'entrega_off'){
        $conn->query("UPDATE bairros SET entrega_disponivel=0 WHERE id='$id'");
    }

    header("Location: bairros.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| EXCLUIR
|--------------------------------------------------------------------------
*/

if(isset($_GET['excluir'])){

    $id = intval($_GET['excluir']);

    $conn->query("
    DELETE FROM bairros
    WHERE id='$id'
    ");

    header("Location: bairros.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| BUSCAR PARA EDITAR
|--------------------------------------------------------------------------
*/

$editar = null;

if(isset($_GET['editar'])){

    $idEditar = intval($_GET['editar']);

    $editar = $conn->query("
    SELECT *
    FROM bairros
    WHERE id='$idEditar'
    ")->fetch_assoc();
}

/*
|--------------------------------------------------------------------------
| PESQUISA
|--------------------------------------------------------------------------
*/

$where = "";

if(isset($_GET['busca']) && !empty($_GET['busca'])){

    $busca = $conn->real_escape_string($_GET['busca']);

    $where = "
    WHERE nome LIKE '%$busca%'
    ";
}

/*
|--------------------------------------------------------------------------
| CARDS
|--------------------------------------------------------------------------
*/

$totalBairros = $conn->query("
SELECT COUNT(*) total
FROM bairros
")->fetch_assoc();

$bairrosAtivos = $conn->query("
SELECT COUNT(*) total
FROM bairros
WHERE ativo=1
")->fetch_assoc();

$entregaDisponivel = $conn->query("
SELECT COUNT(*) total
FROM bairros
WHERE entrega_disponivel=1
")->fetch_assoc();

$taxaMedia = $conn->query("
SELECT COALESCE(AVG(taxa),0) total
FROM bairros
")->fetch_assoc();

/*
|--------------------------------------------------------------------------
| LISTA
|--------------------------------------------------------------------------
*/

$bairros = $conn->query("
SELECT *
FROM bairros
$where
ORDER BY nome ASC
");

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bairros</title>

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

.card-info h4{
    color:#777;
    margin-bottom:10px;
}

.card-info h2{
    color:#111;
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

.form-group input{
    width:100%;
    padding:10px;
    border:1px solid #ddd;
    border-radius:8px;
}

.checks{
    display:flex;
    gap:20px;
    margin:15px 0;
}

.btn-salvar{
    background:#198754;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}

.btn-cancelar{
    background:#6c757d;
    color:#fff;
    padding:12px 20px;
    border-radius:8px;
    text-decoration:none;
    display:inline-block;
}

.busca-box{
    background:#fff;
    padding:20px;
    border-radius:15px;
    margin-bottom:25px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.busca-box form{
    display:flex;
    gap:10px;
}

.busca-box input{
    flex:1;
    padding:10px;
    border:1px solid #ddd;
    border-radius:8px;
}

.btn-busca{
    background:#ff6b00;
    color:#fff;
    border:none;
    padding:10px 20px;
    border-radius:8px;
    cursor:pointer;
}

.badge-ativo,
.badge-entrega{
    background:#d4edda;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.badge-inativo,
.badge-sem-entrega{
    background:#f8d7da;
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
}

.acoes a{
    text-decoration:none;
    margin-right:8px;
    font-size:13px;
}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1 style="margin-bottom:25px;">
Bairros e Taxas de Entrega
</h1>

<div class="dashboard">

<div class="card-info">
<h4>Total de Bairros</h4>
<h2><?= $totalBairros['total']; ?></h2>
</div>

<div class="card-info">
<h4>Bairros Ativos</h4>
<h2><?= $bairrosAtivos['total']; ?></h2>
</div>

<div class="card-info">
<h4>Entrega Disponível</h4>
<h2><?= $entregaDisponivel['total']; ?></h2>
</div>

<div class="card-info">
<h4>Taxa Média</h4>
<h2>R$ <?= number_format($taxaMedia['total'],2,',','.'); ?></h2>
</div>

</div>

<div class="form-card">

<h2>
<?= $editar ? 'Editar Bairro' : 'Novo Bairro'; ?>
</h2>

<br>

<form method="POST">

<input type="hidden" name="id" value="<?= $editar['id'] ?? ''; ?>">

<div class="form-grid">

<div class="form-group">
<label>Nome do Bairro</label>
<input
type="text"
name="nome"
value="<?= $editar['nome'] ?? ''; ?>"
required>
</div>

<div class="form-group">
<label>Taxa de Entrega</label>
<input
type="number"
step="0.01"
name="taxa"
value="<?= $editar['taxa'] ?? '0.00'; ?>">
</div>

<div class="form-group">
<label>Tempo Médio de Entrega (min)</label>
<input
type="number"
name="tempo_entrega"
value="<?= $editar['tempo_entrega'] ?? '30'; ?>">
</div>

<div class="form-group">
<label>Pedido Mínimo</label>
<input
type="number"
step="0.01"
name="pedido_minimo"
value="<?= $editar['pedido_minimo'] ?? '0.00'; ?>">
</div>

</div>

<div class="checks">

<label>
<input
type="checkbox"
name="entrega_disponivel"
<?= (!$editar || $editar['entrega_disponivel']) ? 'checked' : ''; ?>>
Entrega Disponível
</label>

<label>
<input
type="checkbox"
name="ativo"
<?= (!$editar || $editar['ativo']) ? 'checked' : ''; ?>>
Bairro Ativo
</label>

</div>

<button
type="submit"
name="salvar"
class="btn-salvar">

Salvar Bairro

</button>

<?php if($editar){ ?>

<a
href="bairros.php"
class="btn-cancelar">

Cancelar

</a>

<?php } ?>

</form>

</div>

<div class="busca-box">

<form method="GET">

<input
type="text"
name="busca"
placeholder="Buscar bairro"
value="<?= $_GET['busca'] ?? ''; ?>">

<button class="btn-busca">
Pesquisar
</button>

</form>

</div>

<div class="table-box">

<h2>Lista de Bairros</h2>

<br>

<table>

<tr>
<th>ID</th>
<th>Bairro</th>
<th>Taxa</th>
<th>Tempo</th>
<th>Pedido Mínimo</th>
<th>Entrega</th>
<th>Status</th>
<th>Ações</th>
</tr>

<?php while($bairro = $bairros->fetch_assoc()){ ?>

<tr>

<td><?= $bairro['id']; ?></td>

<td><?= $bairro['nome']; ?></td>

<td>
R$ <?= number_format($bairro['taxa'],2,',','.'); ?>
</td>

<td>
<?= $bairro['tempo_entrega']; ?> min
</td>

<td>
R$ <?= number_format($bairro['pedido_minimo'],2,',','.'); ?>
</td>

<td>

<?php if($bairro['entrega_disponivel']){ ?>

<span class="badge-entrega">Sim</span>

<?php }else{ ?>

<span class="badge-sem-entrega">Não</span>

<?php } ?>

</td>

<td>

<?php if($bairro['ativo']){ ?>

<span class="badge-ativo">Ativo</span>

<?php }else{ ?>

<span class="badge-inativo">Inativo</span>

<?php } ?>

</td>

<td class="acoes">

<a href="?editar=<?= $bairro['id']; ?>">
✏ Editar
</a>

<?php if($bairro['ativo']){ ?>

<a
href="?acao=desativar&id=<?= $bairro['id']; ?>"
style="color:red;">

Desativar

</a>

<?php }else{ ?>

<a
href="?acao=ativar&id=<?= $bairro['id']; ?>"
style="color:green;">

Ativar

</a>

<?php } ?>

<?php if($bairro['entrega_disponivel']){ ?>

<a
href="?acao=entrega_off&id=<?= $bairro['id']; ?>"
style="color:#dc3545;">

Sem Entrega

</a>

<?php }else{ ?>

<a
href="?acao=entrega_on&id=<?= $bairro['id']; ?>"
style="color:#198754;">

Com Entrega

</a>

<?php } ?>

<a
href="?excluir=<?= $bairro['id']; ?>"
style="color:red;"
onclick="return confirm('Deseja excluir este bairro?')">

🗑 Excluir

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