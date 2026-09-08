<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

/*
|--------------------------------------------------------------------------
| NOVO CUPOM
|--------------------------------------------------------------------------
*/

if(isset($_POST['salvar'])){

    $codigo = strtoupper(
        $conn->real_escape_string($_POST['codigo'])
    );

    $tipo = $_POST['tipo'];

    $valor = $_POST['valor'];

    $valor_minimo = $_POST['valor_minimo'];

    $quantidade = $_POST['quantidade'];

    $data_inicio = $_POST['data_inicio'];

    $data_fim = $_POST['data_fim'];

    $conn->query("
    INSERT INTO cupons
    (
        codigo,
        tipo,
        valor,
        valor_minimo,
        quantidade,
        data_inicio,
        data_fim,
        ativo
    )
    VALUES
    (
        '$codigo',
        '$tipo',
        '$valor',
        '$valor_minimo',
        '$quantidade',
        '$data_inicio',
        '$data_fim',
        1
    )
    ");

    header("Location: cupons.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| ATIVAR / DESATIVAR
|--------------------------------------------------------------------------
*/

if(isset($_GET['acao'])){

    $id = intval($_GET['id']);

    if($_GET['acao'] == 'ativar'){

        $conn->query("
        UPDATE cupons
        SET ativo=1
        WHERE id='$id'
        ");
    }

    if($_GET['acao'] == 'desativar'){

        $conn->query("
        UPDATE cupons
        SET ativo=0
        WHERE id='$id'
        ");
    }

    header("Location: cupons.php");
    exit;
}

$cupons = $conn->query("
SELECT *
FROM cupons
ORDER BY id DESC
");

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cupons</title>

<link rel="stylesheet"
href="assets/css/style.css">

<style>

.form-card,
.table-box{

background:#fff;
padding:25px;
border-radius:15px;
margin-bottom:25px;
box-shadow:0 3px 15px rgba(0,0,0,.08);

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
.form-group select{

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

}

.badge-inativo{

background:#f8d7da;
padding:5px 10px;
border-radius:20px;

}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Cupons de Desconto</h1>

<div class="form-card">

<h2>Novo Cupom</h2>

<br>

<form method="POST">

<div class="form-group">
<label>Código</label>
<input type="text" name="codigo" required>
</div>

<div class="form-group">
<label>Tipo</label>

<select name="tipo">

<option value="PORCENTAGEM">
Porcentagem
</option>

<option value="VALOR">
Valor Fixo
</option>

</select>

</div>

<div class="form-group">
<label>Valor</label>
<input type="number" step="0.01"
name="valor" required>
</div>

<div class="form-group">
<label>Pedido Mínimo</label>
<input type="number" step="0.01"
name="valor_minimo">
</div>

<div class="form-group">
<label>Quantidade de Uso</label>
<input type="number"
name="quantidade">
</div>

<div class="form-group">
<label>Data Inicial</label>
<input type="date"
name="data_inicio">
</div>

<div class="form-group">
<label>Data Final</label>
<input type="date"
name="data_fim">
</div>

<button
type="submit"
name="salvar"
class="btn-salvar">

Salvar Cupom

</button>

</form>

</div>

<div class="table-box">

<h2>Cupons Cadastrados</h2>

<br>

<table>

<tr>

<th>ID</th>
<th>Código</th>
<th>Tipo</th>
<th>Valor</th>
<th>Usados</th>
<th>Status</th>
<th>Ações</th>

</tr>

<?php while($cupom = $cupons->fetch_assoc()){ ?>

<tr>

<td><?= $cupom['id']; ?></td>

<td>
<strong>
<?= $cupom['codigo']; ?>
</strong>
</td>

<td><?= $cupom['tipo']; ?></td>

<td>

<?php

if($cupom['tipo']=='PORCENTAGEM'){

echo $cupom['valor'].'%';

}else{

echo 'R$ '.number_format(
$cupom['valor'],
2,
',',
'.'
);

}

?>

</td>

<td>

<?= $cupom['usados']; ?>

/

<?= $cupom['quantidade']; ?>

</td>

<td>

<?php if($cupom['ativo']){ ?>

<span class="badge-ativo">

Ativo

</span>

<?php }else{ ?>

<span class="badge-inativo">

Inativo

</span>

<?php } ?>

</td>

<td>

<?php if($cupom['ativo']){ ?>

<a
href="?acao=desativar&id=<?= $cupom['id']; ?>">

Desativar

</a>

<?php }else{ ?>

<a
href="?acao=ativar&id=<?= $cupom['id']; ?>">

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

