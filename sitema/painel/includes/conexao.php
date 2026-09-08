<?php
$host = "localhost";
$user = "espetaria_user";
$pass = "12Marcelo34#";
$banco = "banco_espetaria"; // SEM .sql – nome real do banco

$conn = new mysqli($host, $user, $pass, $banco);

if ($conn->connect_error) {
    die("Erro de conexão: " . $conn->connect_error);
}

// Cria alias $db para compatibilidade com outros arquivos
$db = $conn;

// Define charset UTF-8
$conn->set_charset("utf8mb4");
?>