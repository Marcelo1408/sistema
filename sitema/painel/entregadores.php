<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(isset($_POST['salvar'])){

    $nome = $conn->real_escape_string($_POST['nome']);
    $telefone = $conn->real_escape_string($_POST['telefone']);
    $veiculo = $conn->real_escape_string($_POST['veiculo']);
    $placa = $conn->real_escape_string($_POST['placa']);

    $conn->query("
    INSERT INTO entregadores
    (nome, telefone, veiculo, placa, ativo)
    VALUES
    ('$nome', '$telefone', '$veiculo', '$placa', 1)
    ");

    header("Location: entregadores.php");
    exit;
}

if(isset($_GET['acao']) && isset($_GET['id'])){

    $id = intval($_GET['id']);

    if($_GET['acao'] == 'ativar'){
        $conn->query("UPDATE entregadores SET ativo=1 WHERE id='$id'");
    }

    if($_GET['acao'] == 'desativar'){
        $conn->query("UPDATE entregadores SET ativo=0 WHERE id='$id'");
    }

    header("Location: entregadores.php");
    exit;
}

$entregadores = $conn->query("
SELECT *
FROM entregadores
ORDER BY id DESC
");

$total = $conn->query("
SELECT COUNT(*) total
FROM entregadores
")->fetch_assoc();

$ativos = $conn->query("
SELECT COUNT(*) total
FROM entregadores
WHERE ativo=1
")->fetch_assoc();

?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Entregadores</title>
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

.btn-salvar{
background:#198754;
color:#fff;
border:none;
padding:12px 20px;
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

.acoes a{
text-decoration:none;
margin-right:10px;
}
</style>
</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Entregadores</h1>

<div class="dashboard">

<div class="card-info">
<h4>Total de Entregadores</h4>
<h2><?= $total['total']; ?></h2>
</div>

<div class="card-info">
<h4>Entregadores Ativos</h4>
<h2><?= $ativos['total']; ?></h2>
</div>

</div>

<div class="form-card">

<h2>Novo Entregador</h2>
<br>

<form method="POST">

<div class="form-group">
<label>Nome</label>
<input type="text" name="nome" required>
</div>

<div class="form-group">
<label>Telefone / WhatsApp</label>
<input type="text" name="telefone">
</div>

<div class="form-group">
<label>Veículo</label>
<input type="text" name="veiculo" placeholder="Moto, carro, bicicleta...">
</div>

<div class="form-group">
<label>Placa</label>
<input type="text" name="placa">
</div>

<button type="submit" name="salvar" class="btn-salvar">
Salvar Entregador
</button>

</form>

</div>

<div class="table-box">

<h2>Lista de Entregadores</h2>
<br>

<table>

<tr>
<th>ID</th>
<th>Nome</th>
<th>Telefone</th>
<th>Veículo</th>
<th>Placa</th>
<th>Status</th>
<th>Ações</th>
</tr>

<?php while($entregador = $entregadores->fetch_assoc()){ ?>

<tr>

<td><?= $entregador['id']; ?></td>

<td><?= $entregador['nome']; ?></td>

<td><?= $entregador['telefone']; ?></td>

<td><?= $entregador['veiculo']; ?></td>

<td><?= $entregador['placa']; ?></td>

<td>
<?php if($entregador['ativo']){ ?>
<span class="badge-ativo">Ativo</span>
<?php }else{ ?>
<span class="badge-inativo">Inativo</span>
<?php } ?>
</td>

<td class="acoes">

<?php if($entregador['ativo']){ ?>
<a href="?acao=desativar&id=<?= $entregador['id']; ?>" style="color:red;">
Desativar
</a>
<?php }else{ ?>
<a href="?acao=ativar&id=<?= $entregador['id']; ?>" style="color:green;">
Ativar
</a>
<?php } ?>

</td>

</tr>

<?php } ?>

</table>

</div>

</div>

</div>

</body>
</html>