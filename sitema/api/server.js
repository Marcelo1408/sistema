const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {

    res.json({

        status: true,
        sistema: "API Espetaria",
        versao: "1.0",
        mensagem: "API funcionando com sucesso."

    });

});

// =====================
// ROTAS
// =====================

app.use('/produtos', require('./routes/produtos'));
app.use('/promocoes', require('./routes/promocoes'));
app.use('/combos', require('./routes/combos'));
app.use('/pedidos', require('./routes/pedidos'));
app.use('/clientes', require('./routes/clientes'));
app.use('/pix', require('./routes/pix'));
app.use('/adicionais', require('./routes/adicionais'));
app.use('/loja', require('./routes/loja'));
app.use('/calculo-de-entrega', require('./routes/calculo-de-entrega'));

// Futuras rotas

// app.use('/pedidos', require('./routes/pedidos'));
// app.use('/clientes', require('./routes/clientes'));
// app.use('/bairros', require('./routes/bairros'));
// app.use('/cupom', require('./routes/cupons'));
// app.use('/pagamentos', require('./routes/pagamentos'));

// =====================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log("====================================");
    console.log("ðŸš€ API ESPETARIA ONLINE");
    console.log("ðŸŒ Porta:", PORT);
    console.log("====================================");

});