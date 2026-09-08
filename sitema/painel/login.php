<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
session_start();

include 'includes/conexao.php';

if(isset($_SESSION['usuario_id'])){
    header("Location: dashboard.php");
    exit;
}

$erro = "";

if(isset($_POST['entrar'])){

    $usuario = $conn->real_escape_string($_POST['usuario']);
    $senhaDigitada = $_POST['senha'];

    $sql = $conn->query("
    SELECT *
    FROM usuarios_sistema
    WHERE usuario='$usuario'
    AND ativo=1
    LIMIT 1
    ");

    if($sql->num_rows > 0){

        $user = $sql->fetch_assoc();

        $senhaOk = false;

        // Senha nova (password_hash)

        if(password_verify($senhaDigitada,$user['senha'])){

            $senhaOk = true;

        }

        // Senha antiga MD5

        elseif(md5($senhaDigitada) == $user['senha']){

            $senhaOk = true;

            $novaHash = password_hash(
                $senhaDigitada,
                PASSWORD_DEFAULT
            );

            $conn->query("
            UPDATE usuarios_sistema
            SET senha='$novaHash'
            WHERE id='{$user['id']}'
            ");

        }

        if($senhaOk){

            $_SESSION['usuario_id'] = $user['id'];
            $_SESSION['nome'] = $user['nome'];
            $_SESSION['usuario'] = $user['usuario'];
            $_SESSION['nivel'] = $user['nivel'];

            $conn->query("
            UPDATE usuarios_sistema
            SET ultimo_acesso=NOW()
            WHERE id='{$user['id']}'
            ");

            header("Location: dashboard.php");
            exit;

        }

    }

    $erro = "Usuário ou senha inválidos.";

}

?>

<!DOCTYPE html>

<html lang="pt-br">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Painel da Espetaria</title>
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>

*{
margin:0;
padding:0;
box-sizing:border-box;
font-family:'Segoe UI',sans-serif;
}

body{

height:100vh;

display:flex;

justify-content:center;

align-items:center;

background:
linear-gradient(135deg,#111827,#1f2937);

}

.login-box{

width:420px;

background:#fff;

padding:40px;

border-radius:20px;

box-shadow:0 15px 35px rgba(0,0,0,.30);

}

.logo{

text-align:center;

margin-bottom:30px;

}

.logo h1{

font-size:34px;

color:#111827;

}

.logo span{

color:#ff6b00;

}

.logo p{

margin-top:8px;

color:#777;

}

.form-group{

margin-bottom:18px;

}

.form-group label{

display:block;

margin-bottom:6px;

font-weight:bold;

color:#333;

}

.form-group input{

width:100%;

padding:13px;

border:1px solid #ddd;

border-radius:10px;

font-size:15px;

}

.form-group input:focus{

outline:none;

border-color:#ff6b00;

}

.btn{

width:100%;

padding:14px;

background:#ff6b00;

color:#fff;

border:none;

border-radius:10px;

cursor:pointer;

font-size:17px;

font-weight:bold;

transition:.3s;

}

.btn:hover{

background:#e85d00;

}

.erro{

background:#f8d7da;

color:#842029;

padding:12px;

border-radius:8px;

margin-bottom:15px;

text-align:center;

}

.rodape{

margin-top:25px;

text-align:center;

color:#999;

font-size:13px;

}

</style>

</head>

<body>

<div class="login-box">

<div class="logo">

<h1>

🍢 <span>ESPETARIA</span>

</h1>

<p>

Painel Administrativo

</p>

</div>

<?php if($erro!=""){ ?>

<div class="erro">

<?= $erro; ?>

</div>

<?php } ?>

<form method="POST">

<div class="form-group">

<label>

Usuário

</label>

<input
type="text"
name="usuario"
required>

</div>

<div class="form-group">

<label>

Senha

</label>

<input
type="password"
name="senha"
required>

</div>

<button
class="btn"
type="submit"
name="entrar">

Entrar

</button>

</form>

<div class="rodape">

Sistema de Gestão da Espetaria © <?= date("Y"); ?>

</div>

</div>

</body>

</html>