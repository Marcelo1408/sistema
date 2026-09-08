<?php



session_start();
include 'includes/conexao.php';
include 'includes/auth.php';


function colunaExisteConfiguracoes($conn, $coluna){
    $coluna = $conn->real_escape_string($coluna);
    $res = $conn->query("SHOW COLUMNS FROM configuracoes LIKE '$coluna'");
    return $res && $res->num_rows > 0;
}

function garantirColunasEntrega($conn){
    if(!colunaExisteConfiguracoes($conn, 'entrega_km_base')){
        $conn->query("ALTER TABLE configuracoes ADD COLUMN entrega_km_base DECIMAL(10,2) NOT NULL DEFAULT 3.00 AFTER taxa_entrega");
    }

    if(!colunaExisteConfiguracoes($conn, 'entrega_valor_km_adicional')){
        $conn->query("ALTER TABLE configuracoes ADD COLUMN entrega_valor_km_adicional DECIMAL(10,2) NOT NULL DEFAULT 2.00 AFTER entrega_km_base");
    }

    if(!colunaExisteConfiguracoes($conn, 'entrega_taxa_fallback')){
        $conn->query("ALTER TABLE configuracoes ADD COLUMN entrega_taxa_fallback DECIMAL(10,2) NOT NULL DEFAULT 10.00 AFTER entrega_valor_km_adicional");
    }

    if(!colunaExisteConfiguracoes($conn, 'loja_lat')){
        $conn->query("ALTER TABLE configuracoes ADD COLUMN loja_lat VARCHAR(50) DEFAULT NULL AFTER entrega_taxa_fallback");
    }

    if(!colunaExisteConfiguracoes($conn, 'loja_lng')){
        $conn->query("ALTER TABLE configuracoes ADD COLUMN loja_lng VARCHAR(50) DEFAULT NULL AFTER loja_lat");
    }
}

garantirColunasEntrega($conn);

/*
|--------------------------------------------------------------------------
| SALVAR
|--------------------------------------------------------------------------
*/

if(isset($_POST['salvar'])){

    $nome_empresa = $conn->real_escape_string($_POST['nome_empresa']);
    $telefone = $conn->real_escape_string($_POST['telefone']);
    $whatsapp = $conn->real_escape_string($_POST['whatsapp']);
    $email = $conn->real_escape_string($_POST['email']);
    $endereco = $conn->real_escape_string($_POST['endereco']);
    $cidade = $conn->real_escape_string($_POST['cidade']);
    $estado = $conn->real_escape_string($_POST['estado']);
    $cep = $conn->real_escape_string($_POST['cep']);
    $chave_pix = $conn->real_escape_string($_POST['chave_pix']);
    $taxa_entrega = number_format((float)str_replace(',', '.', $_POST['taxa_entrega']), 2, '.', '');
    $entrega_km_base = number_format((float)str_replace(',', '.', $_POST['entrega_km_base']), 2, '.', '');
    $entrega_valor_km_adicional = number_format((float)str_replace(',', '.', $_POST['entrega_valor_km_adicional']), 2, '.', '');
    $entrega_taxa_fallback = number_format((float)str_replace(',', '.', $_POST['entrega_taxa_fallback']), 2, '.', '');
    $loja_lat = $conn->real_escape_string(trim($_POST['loja_lat'] ?? ''));
    $loja_lng = $conn->real_escape_string(trim($_POST['loja_lng'] ?? ''));

    if((float)$taxa_entrega < 0){ $taxa_entrega = '0.00'; }
    if((float)$entrega_km_base <= 0){ $entrega_km_base = '3.00'; }
    if((float)$entrega_valor_km_adicional < 0){ $entrega_valor_km_adicional = '0.00'; }
    if((float)$entrega_taxa_fallback < 0){ $entrega_taxa_fallback = $taxa_entrega; }

    $tempo_preparo = intval($_POST['tempo_preparo']);
    $horario_abertura = $conn->real_escape_string($_POST['horario_abertura']);
    $horario_fechamento = $conn->real_escape_string($_POST['horario_fechamento']);

    $sqlLogo = "";

    if(isset($_FILES['logo']) && $_FILES['logo']['error'] == 0){

        $pasta = "uploads/";

        if(!is_dir($pasta)){
            mkdir($pasta, 0777, true);
        }

        $extensao = strtolower(pathinfo($_FILES['logo']['name'], PATHINFO_EXTENSION));

        $permitidas = ['jpg','jpeg','png','webp'];

        if(in_array($extensao, $permitidas)){

            $nomeLogo = 'logo_' . time() . '.' . $extensao;

            move_uploaded_file(
                $_FILES['logo']['tmp_name'],
                $pasta . $nomeLogo
            );

            $sqlLogo = ", logo='$nomeLogo'";
        }
    }

    $conn->query("
    UPDATE configuracoes SET

    nome_empresa='$nome_empresa',
    telefone='$telefone',
    whatsapp='$whatsapp',
    email='$email',
    endereco='$endereco',
    cidade='$cidade',
    estado='$estado',
    cep='$cep',
    chave_pix='$chave_pix',
    taxa_entrega='$taxa_entrega',
    entrega_km_base='$entrega_km_base',
    entrega_valor_km_adicional='$entrega_valor_km_adicional',
    entrega_taxa_fallback='$entrega_taxa_fallback',
    loja_lat='$loja_lat',
    loja_lng='$loja_lng',
    tempo_preparo='$tempo_preparo',
    horario_abertura='$horario_abertura',
    horario_fechamento='$horario_fechamento'
    $sqlLogo

    WHERE id=1
    ");

    header("Location: configuracoes.php?ok=1");
    exit;
}

$config = $conn->query("
SELECT *
FROM configuracoes
WHERE id=1
")->fetch_assoc();

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Configurações</title>

<link rel="stylesheet"
href="assets/css/style.css">

<style>

.form-card{
    background:#fff;
    padding:25px;
    border-radius:15px;
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
.form-group textarea,
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

.alerta{
    background:#d4edda;
    padding:15px;
    border-radius:10px;
    margin-bottom:20px;
}

.logo-preview{
    max-width:180px;
    max-height:120px;
    display:block;
    margin:10px 0;
    border-radius:10px;
    border:1px solid #ddd;
    padding:5px;
    background:#fff;
}


.entrega-card{
    border:1px solid #f0d6c0;
    background:#fff8f2;
    padding:20px;
    border-radius:15px;
    margin:20px 0;
}

.entrega-card h3{
    margin-bottom:8px;
}

.entrega-ajuda{
    color:#555;
    font-size:14px;
    margin-bottom:15px;
    line-height:1.5;
}

.form-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:15px;
}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?>

<div class="content">

<h1>Configurações</h1>

<?php if(isset($_GET['ok'])){ ?>

<div class="alerta">
Configurações salvas com sucesso.
</div>

<?php } ?>

<div class="form-card">

<form method="POST" enctype="multipart/form-data">

<div class="form-group">
<label>Nome da Espetaria</label>
<input type="text" name="nome_empresa"
value="<?= $config['nome_empresa']; ?>">
</div>

<div class="form-group">
<label>Logo da Espetaria</label>

<?php if(!empty($config['logo'])){ ?>

<img
src="uploads/<?= $config['logo']; ?>"
class="logo-preview">

<?php } ?>

<input type="file" name="logo" accept="image/*">
</div>

<div class="form-group">
<label>Telefone</label>
<input type="text" name="telefone"
value="<?= $config['telefone']; ?>">
</div>

<div class="form-group">
<label>WhatsApp</label>
<input type="text" name="whatsapp"
value="<?= $config['whatsapp']; ?>">
</div>

<div class="form-group">
<label>Email</label>
<input type="text" name="email"
value="<?= $config['email']; ?>">
</div>

<div class="form-group">
<label>Endereço</label>
<textarea name="endereco"><?= $config['endereco']; ?></textarea>
</div>

<div class="form-group">
<label>Cidade</label>
<input type="text" name="cidade"
value="<?= $config['cidade']; ?>">
</div>

<div class="form-group">
<label>Estado</label>
<input type="text" name="estado"
value="<?= $config['estado']; ?>">
</div>

<div class="form-group">
<label>CEP</label>
<input type="text" name="cep"
value="<?= $config['cep']; ?>">
</div>

<div class="form-group">
<label>Chave PIX</label>
<input type="text" name="chave_pix"
value="<?= $config['chave_pix']; ?>">
</div>

<div class="entrega-card">
<h3>🚚 Regra da Taxa de Entrega</h3>
<p class="entrega-ajuda">
Use esta regra para o bot calcular a entrega automaticamente pela distância do endereço do cliente.<br>
Exemplo: até 3 km cobra R$ 10,00. Acima de 3 km soma R$ 2,00 por km adicional.
</p>

<div class="form-grid">

<div class="form-group">
<label>Taxa base até o limite de km (R$)</label>
<input type="number"
step="0.01"
min="0"
name="taxa_entrega"
value="<?= $config['taxa_entrega']; ?>">
</div>

<div class="form-group">
<label>Limite da taxa base (km)</label>
<input type="number"
step="0.01"
min="0.01"
name="entrega_km_base"
value="<?= $config['entrega_km_base'] ?? '3.00'; ?>">
</div>

<div class="form-group">
<label>Valor por km adicional (R$)</label>
<input type="number"
step="0.01"
min="0"
name="entrega_valor_km_adicional"
value="<?= $config['entrega_valor_km_adicional'] ?? '2.00'; ?>">
</div>

<div class="form-group">
<label>Taxa se o mapa falhar (R$)</label>
<input type="number"
step="0.01"
min="0"
name="entrega_taxa_fallback"
value="<?= $config['entrega_taxa_fallback'] ?? $config['taxa_entrega']; ?>">
</div>

<div class="form-group">
<label>Latitude da loja</label>
<input type="text"
name="loja_lat"
placeholder="Ex: -22.8583"
value="<?= $config['loja_lat'] ?? ''; ?>">
</div>

<div class="form-group">
<label>Longitude da loja</label>
<input type="text"
name="loja_lng"
placeholder="Ex: -47.2200"
value="<?= $config['loja_lng'] ?? ''; ?>">
</div>

</div>
</div>

<div class="form-group">
<label>Tempo Médio de Preparo (min)</label>
<input type="number"
name="tempo_preparo"
value="<?= $config['tempo_preparo']; ?>">
</div>

<div class="form-group">
<label>Horário de Abertura</label>
<input type="time"
name="horario_abertura"
value="<?= $config['horario_abertura']; ?>">
</div>

<div class="form-group">
<label>Horário de Fechamento</label>
<input type="time"
name="horario_fechamento"
value="<?= $config['horario_fechamento']; ?>">
</div>

<button
type="submit"
name="salvar"
class="btn-salvar">

Salvar Configurações

</button>

</form>

</div>

</div>

</div>

</body>

</html>

