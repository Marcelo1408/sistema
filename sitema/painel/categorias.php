<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';
/*
|--------------------------------------------------------------------------
| NOVA CATEGORIA
|--------------------------------------------------------------------------
*/

if(isset($_POST['salvar'])){

    $nome = $conn->real_escape_string($_POST['nome']);

    $conn->query("
    INSERT INTO categorias
    (
        nome,
        ativo
    )
    VALUES
    (
        '$nome',
        1
    )
    ");

    header("Location: categorias.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| ATIVAR / DESATIVAR
|--------------------------------------------------------------------------
*/

if(isset($_GET['acao']) && isset($_GET['id'])){

    $id = intval($_GET['id']);

    if($_GET['acao'] == 'ativar'){

        $conn->query("
        UPDATE categorias
        SET ativo=1
        WHERE id='$id'
        ");
    }

    if($_GET['acao'] == 'desativar'){

        $conn->query("
        UPDATE categorias
        SET ativo=0
        WHERE id='$id'
        ");
    }

    header("Location: categorias.php");
    exit;
}

/*
|--------------------------------------------------------------------------
| LISTAGEM
|--------------------------------------------------------------------------
*/

$categorias = $conn->query("
SELECT
c.*,
(
    SELECT COUNT(*)
    FROM produtos p
    WHERE p.categoria_id = c.id
) total_produtos

FROM categorias c

ORDER BY c.nome ASC
");

$totalCategorias = $conn->query("
SELECT COUNT(*) total
FROM categorias
")->fetch_assoc()['total'];

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Categorias</title>

<link rel="stylesheet"
href="assets/css/style.css">

<style>

.dashboard{
display:grid;
grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
gap:20px;
margin-bottom:20px;
}

.card-info{
background:#fff;
padding:20px;
border-radius:15px;
box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.form-card{
background:#fff;
padding:20px;
border-radius:15px;
margin-bottom:20px;
box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.form-card input{
width:100%;
padding:12px;
border:1px solid #ddd;
border-radius:8px;
margin-bottom:15px;
}

.btn-salvar{
background:#198754;
color:#fff;
border:none;
padding:10px 20px;
border-radius:8px;
cursor:pointer;
}

.table-box{
background:#fff;
padding:20px;
border-radius:15px;
box-shadow:0 3px 15px rgba(0,0,0,.08);
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

<h1>Categorias</h1>

<div class="dashboard">

<div class="card-info">

<h3>Total de Categorias</h3>

<h2><?= $totalCategorias ?></h2>

</div>

</div>

<div class="form-card">

<h2>Nova Categoria</h2>

<br>

<form method="POST">

<input
type="text"
name="nome"
placeholder="Nome da categoria"
required>

<button
type="submit"
name="salvar"
class="btn-salvar">

Salvar Categoria

</button>

</form>

</div>

<div class="table-box">

<h2>Lista de Categorias</h2>

<br>

<table>

<tr>
<th>ID</th>
<th>Categoria</th>
<th>Produtos</th>
<th>Status</th>
<th>Ações</th>
</tr>

<?php while($categoria = $categorias->fetch_assoc()){ ?>

<tr>

<td>
<?= $categoria['id']; ?>
</td>

<td>
<?= $categoria['nome']; ?>
</td>

<td>
<?= $categoria['total_produtos']; ?>
</td>

<td>

<?php if($categoria['ativo']){ ?>

<span class="badge-ativo">
Ativa
</span>

<?php } else { ?>

<span class="badge-inativo">
Inativa
</span>

<?php } ?>

</td>

<td>

<?php if($categoria['ativo']){ ?>

<a
href="?acao=desativar&id=<?= $categoria['id']; ?>"
style="color:red">

Desativar

</a>

<?php } else { ?>

<a
href="?acao=ativar&id=<?= $categoria['id']; ?>"
style="color:green">

Ativar

</a>

<?php } ?>

<a
href="editar_categoria.php?id=<?= $categoria['id']; ?>">

✏ Editar

</a>

<a
href="excluir_categoria.php?id=<?= $categoria['id']; ?>"
style="color:red">

🗑 Excluir

</a>

</tr>

<?php } ?>

</table>

</div>

</div>

</div>

</body>

</html>