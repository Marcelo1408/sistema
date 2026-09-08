<?php

session_start();
include 'includes/conexao.php';
include 'includes/auth.php';

$id = intval($_SESSION['usuario_id']);

$erro = '';
$sucesso = '';

$usuarioLogado = $conn->query("
SELECT *
FROM usuarios_sistema
WHERE id='$id'
")->fetch_assoc();

if(isset($_POST['salvar'])){

    $nome = $conn->real_escape_string($_POST['nome']);
    $usuario = $conn->real_escape_string($_POST['usuario']);
    $telefone = $conn->real_escape_string($_POST['telefone']);

    $senha_atual = $_POST['senha_atual'] ?? '';
    $nova_senha = $_POST['nova_senha'] ?? '';
    $confirmar_senha = $_POST['confirmar_senha'] ?? '';

    $verificaUsuario = $conn->query("
    SELECT id
    FROM usuarios_sistema
    WHERE usuario='$usuario'
    AND id!='$id'
    ");

    if($verificaUsuario->num_rows > 0){

        $erro = "Este nome de usuário já está sendo usado.";

    }else{

        $sqlFoto = "";

        if(isset($_FILES['foto']) && $_FILES['foto']['error'] == 0){

            $pasta = "uploads/perfis/";

            if(!is_dir($pasta)){
                mkdir($pasta, 0777, true);
            }

            $ext = strtolower(pathinfo($_FILES['foto']['name'], PATHINFO_EXTENSION));
            $permitidas = ['jpg','jpeg','png','webp'];

            if(in_array($ext, $permitidas)){

                $nomeFoto = "perfil_" . $id . "_" . time() . "." . $ext;

                move_uploaded_file(
                    $_FILES['foto']['tmp_name'],
                    $pasta . $nomeFoto
                );

                $sqlFoto = ", foto='$nomeFoto'";
            }
        }

        $sqlSenha = "";

        if(!empty($nova_senha)){

            if(empty($senha_atual)){

                $erro = "Informe a senha atual para alterar a senha.";

            }elseif($nova_senha !== $confirmar_senha){

                $erro = "A nova senha e a confirmação não conferem.";

            }elseif(strlen($nova_senha) < 6){

                $erro = "A nova senha precisa ter pelo menos 6 caracteres.";

            }else{

                $senhaOk = false;

                if(password_verify($senha_atual, $usuarioLogado['senha'])){
                    $senhaOk = true;
                }

                if(md5($senha_atual) === $usuarioLogado['senha']){
                    $senhaOk = true;
                }

                if(!$senhaOk){

                    $erro = "Senha atual incorreta.";

                }else{

                    $novaHash = password_hash($nova_senha, PASSWORD_DEFAULT);
                    $sqlSenha = ", senha='$novaHash'";
                }
            }
        }

        if(empty($erro)){

            $conn->query("
            UPDATE usuarios_sistema SET
            nome='$nome',
            usuario='$usuario',
            telefone='$telefone'
            $sqlFoto
            $sqlSenha
            WHERE id='$id'
            ");

            $_SESSION['nome'] = $nome;
            $_SESSION['usuario'] = $usuario;

            $sucesso = "Perfil atualizado com sucesso.";

            $usuarioLogado = $conn->query("
            SELECT *
            FROM usuarios_sistema
            WHERE id='$id'
            ")->fetch_assoc();
        }
    }
}

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Meu Perfil</title>
<link rel="stylesheet" href="assets/css/style.css">

<style>
.perfil-grid{
    display:grid;
    grid-template-columns:300px 1fr;
    gap:25px;
}

.card-perfil,
.form-card{
    background:#fff;
    padding:25px;
    border-radius:15px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.foto-perfil{
    width:140px;
    height:140px;
    object-fit:cover;
    border-radius:50%;
    display:block;
    margin:0 auto 15px auto;
    border:4px solid #ff6b00;
}

.avatar{
    width:140px;
    height:140px;
    border-radius:50%;
    background:#ff6b00;
    color:#fff;
    font-size:55px;
    display:flex;
    align-items:center;
    justify-content:center;
    margin:0 auto 15px auto;
}

.card-perfil{
    text-align:center;
}

.card-perfil h2{
    margin-bottom:5px;
}

.card-perfil p{
    color:#666;
    margin-bottom:8px;
}

.badge-nivel{
    display:inline-block;
    padding:6px 12px;
    border-radius:20px;
    background:#fff3cd;
    font-weight:bold;
    margin-top:10px;
}

.form-group{
    margin-bottom:15px;
}

.form-group label{
    display:block;
    margin-bottom:6px;
    font-weight:bold;
}

.form-group input{
    width:100%;
    padding:11px;
    border:1px solid #ddd;
    border-radius:8px;
}

.form-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:15px;
}

.input-senha{
    display:flex;
    align-items:center;
    gap:8px;
}

.input-senha input{
    flex:1;
}

.btn-ver{
    width:45px;
    height:43px;
    border:none;
    border-radius:8px;
    background:#ff6b00;
    color:#fff;
    cursor:pointer;
    font-size:18px;
}

.btn-salvar{
    background:#198754;
    color:#fff;
    border:none;
    padding:12px 20px;
    border-radius:8px;
    cursor:pointer;
}

.alerta-sucesso{
    background:#d4edda;
    padding:15px;
    border-radius:10px;
    margin-bottom:20px;
}

.alerta-erro{
    background:#f8d7da;
    padding:15px;
    border-radius:10px;
    margin-bottom:20px;
}

@media(max-width:900px){
    .perfil-grid{
        grid-template-columns:1fr;
    }
}
</style>
</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1 style="margin-bottom:25px;">Meu Perfil</h1>

<?php if($sucesso){ ?>
<div class="alerta-sucesso"><?= $sucesso; ?></div>
<?php } ?>

<?php if($erro){ ?>
<div class="alerta-erro"><?= $erro; ?></div>
<?php } ?>

<div class="perfil-grid">

<div class="card-perfil">

<?php if(!empty($usuarioLogado['foto'])){ ?>

<img src="uploads/perfis/<?= $usuarioLogado['foto']; ?>" class="foto-perfil">

<?php }else{ ?>

<div class="avatar">👤</div>

<?php } ?>

<h2><?= $usuarioLogado['nome']; ?></h2>

<p>@<?= $usuarioLogado['usuario']; ?></p>

<p>📱 <?= $usuarioLogado['telefone'] ?: 'Sem telefone'; ?></p>

<span class="badge-nivel"><?= $usuarioLogado['nivel']; ?></span>

<br><br>

<p>
<strong>Último acesso:</strong>
<br>

<?php if(!empty($usuarioLogado['ultimo_acesso'])){ ?>
<?= date('d/m/Y H:i', strtotime($usuarioLogado['ultimo_acesso'])); ?>
<?php }else{ ?>
Não registrado
<?php } ?>
</p>

</div>

<div class="form-card">

<h2>Editar Perfil</h2>
<br>

<form method="POST" enctype="multipart/form-data">

<div class="form-grid">

<div class="form-group">
<label>Nome</label>
<input type="text" name="nome" value="<?= $usuarioLogado['nome']; ?>" required>
</div>

<div class="form-group">
<label>Usuário</label>
<input type="text" name="usuario" value="<?= $usuarioLogado['usuario']; ?>" required>
</div>

<div class="form-group">
<label>Telefone</label>
<input type="text" name="telefone" value="<?= $usuarioLogado['telefone']; ?>">
</div>

</div>

<div class="form-group">
<label>Foto de Perfil</label>
<input type="file" name="foto" accept="image/*">
</div>

<hr style="margin:25px 0;">

<h3>Alterar Senha</h3>
<br>

<div class="form-grid">

<div class="form-group">
<label>Senha Atual</label>
<div class="input-senha">
<input type="password" id="senha_atual" name="senha_atual" placeholder="Informe apenas se for trocar a senha">
<button type="button" class="btn-ver" onclick="toggleSenha('senha_atual')">👁</button>
</div>
</div>

<div class="form-group">
<label>Nova Senha</label>
<div class="input-senha">
<input type="password" id="nova_senha" name="nova_senha" placeholder="Mínimo 6 caracteres">
<button type="button" class="btn-ver" onclick="toggleSenha('nova_senha')">👁</button>
</div>
</div>

<div class="form-group">
<label>Confirmar Nova Senha</label>
<div class="input-senha">
<input type="password" id="confirmar_senha" name="confirmar_senha" placeholder="Confirme a nova senha">
<button type="button" class="btn-ver" onclick="toggleSenha('confirmar_senha')">👁</button>
</div>
</div>

</div>

<button type="submit" name="salvar" class="btn-salvar">
Salvar Alterações
</button>

</form>

</div>

</div>

</div>

</div>

<script>
function toggleSenha(id){
    const campo = document.getElementById(id);

    if(campo.type === "password"){
        campo.type = "text";
    }else{
        campo.type = "password";
    }
}
</script>

</body>
</html>