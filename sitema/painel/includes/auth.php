<?php

if(session_status() === PHP_SESSION_NONE){
    session_start();
}

if(!isset($_SESSION['usuario_id'])){
    header("Location: login.php");
    exit;
}

function somenteAdm(){

    if(!isset($_SESSION['nivel']) || $_SESSION['nivel'] !== 'ADM'){

        ?>
        <!DOCTYPE html>
        <html lang="pt-br">

        <head>

        <meta charset="UTF-8">

        <title>Acesso Negado</title>

        <link rel="stylesheet" href="assets/css/style.css">

        <style>

        .acesso-negado-card{
            background:#fff;
            padding:35px;
            border-radius:18px;
            box-shadow:0 3px 15px rgba(0,0,0,.08);
            max-width:650px;
            margin:40px auto;
            text-align:center;
        }

        .acesso-negado-card .icone{
            font-size:60px;
            margin-bottom:15px;
        }

        .acesso-negado-card h1{
            color:#dc3545;
            margin-bottom:10px;
        }

        .acesso-negado-card p{
            color:#555;
            font-size:16px;
            margin-bottom:25px;
        }

        .btn-voltar{
            background:#ff6b00;
            color:#fff;
            padding:12px 22px;
            border-radius:8px;
            text-decoration:none;
            display:inline-block;
        }

        </style>

        </head>

        <body>

        <?php include 'includes/sidebar.php'; ?>

        <div class="main">

        <?php include 'includes/topbar.php'; ?>

        <div class="content">

        <div class="acesso-negado-card">

            <div class="icone">🔒</div>

            <h1>Acesso negado</h1>

            <p>
                Apenas o administrador pode acessar esta área do sistema.
            </p>

            <a href="dashboard.php" class="btn-voltar">
                Voltar para o Dashboard
            </a>

        </div>

        </div>

        </div>

        </body>
        </html>

        <?php

        exit;
    }
}