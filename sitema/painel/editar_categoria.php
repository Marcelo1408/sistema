<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

if(!isset($_GET['id'])){

    header("Location: categorias.php");
    exit;
}

$id = intval($_GET['id']);

/*
|--------------------------------------------------------------------------
| BUSCAR CATEGORIA
|--------------------------------------------------------------------------
*/

$categoria = $conn->query("
SELECT *
FROM categorias
WHERE id='$id'
");

if($categoria->num_rows == 0){

    die("Categoria não encontrada.");
}

$categoria = $categoria->fetch_assoc();

/*
|--------------------------------------------------------------------------
| SALVAR
|--------------------------------------------------------------------------
*/

if(isset($_POST['salvar'])){

    $nome = $conn->real_escape_string($_POST['nome']);
    $ativo = intval($_POST['ativo']);

    $conn->query("
    UPDATE categorias
    SET
    nome='$nome',
    ativo='$ativo'
    WHERE id='$id'
    ");

    header("Location: categorias.php");
    exit;
}

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Editar Categoria</title>

<link rel="stylesheet"
href="assets/css/style.css">

<style>

.form-card{
    background:#fff;
    padding:25px;
    border-radius:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
    max-width:800px;
}

.form-group{
    margin-bottom:20px;
}

.form-group label{
    display:block;
    margin-bottom:8px;
    font-weight:bold;
}

.form-group input,
.form-group select{
    width:100%;
    padding:12px;
    border:1px solid #ddd;
    border-radius:8px;
}

.botoes{
    display:flex;
    gap:10px;
    margin-top:20px;
}

.btn-salvar{
    background:#198754;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}

.btn-voltar{
    background:#6c757d;
    color:#fff;
    padding:12px 20px;
    border-radius:8px;
    text-decoration:none;
}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Editar Categoria</h1>

<div class="form-card">

<form method="POST">

<div class="form-group">

<label>Nome da Categoria</label>

<input
type="text"
name="nome"
value="<?= htmlspecialchars($categoria['nome']) ?>"
required>

</div>

<div class="form-group">

<label>Status</label>

<select name="ativo">

<option
value="1"
<?= $categoria['ativo'] == 1 ? 'selected' : '' ?>>

Ativa

</option>

<option
value="0"
<?= $categoria['ativo'] == 0 ? 'selected' : '' ?>>

Inativa

</option>

</select>

</div>

<div class="botoes">

<button
type="submit"
name="salvar"
class="btn-salvar">

Salvar Alterações

</button>

<a
href="categorias.php"
class="btn-voltar">

⬅ Voltar

</a>

</div>

</form>

</div>

</div>

</div>

</body>

</html>

