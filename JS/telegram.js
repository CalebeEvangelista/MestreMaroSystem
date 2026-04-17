let dadosLoja = []

async function guardarDados() {
    const idLoja = localStorage.getItem('selecaoLoja')

    const db = firebase.firestore();
    const snapshot = await db.collection('lojas').where('id', '==', idLoja).get()

    const loja = snapshot.docs[0].data();

    const nomeLoja = loja.nome.split(' ')

    dadosLoja.push({
        nome: nomeLoja[0],
        chavePix: loja.chavePix,
        cidade: loja.cidade,
        chatID: loja.chatID
    })

    console.log(dadosLoja)
}

//GERA O PIX E ENVIA A IMAGEM E CODIGO NO TELEGRAM
async function gerarPixEEnviarTelegram(valor) {
    try {
        const pixCopiaECola = gerarPix(valor);
        const qrCodeBase64 = await gerarQrCodeBase64(pixCopiaECola);

        await enviarTelegramImagem(
            qrCodeBase64,
            `Pagamento Pix\nValor: R$ ${Number(valor).toFixed(2).replace(".", ",")}`
        );

        await enviarTelegram(pixCopiaECola);
        alert('PIX enviado com sucesso')

    } catch (erro) {
        console.error("Erro no fluxo do Pix:", erro);
    }
}

function gerarPix(valor) {
    const chave = dadosLoja[0].chavePix
    const nome = dadosLoja[0].nome.toUpperCase()
    const cidade = dadosLoja[0].cidade.toUpperCase()

    function format(id, value) {
        const v = String(value);
        const size = v.length.toString().padStart(2, "0");
        return id + size + v;
    }

    function crc16(str) {
        let crc = 0xFFFF;

        for (let c = 0; c < str.length; c++) {
            crc ^= str.charCodeAt(c) << 8;

            for (let i = 0; i < 8; i++) {
                if ((crc & 0x8000) !== 0) {
                    crc = (crc << 1) ^ 0x1021;
                } else {
                    crc = crc << 1;
                }
            }
        }

        crc &= 0xFFFF;
        return crc.toString(16).toUpperCase().padStart(4, "0");
    }

    const valorFormatado = Number(valor).toFixed(2);

    let payload = "";

    payload += format("00", "01");
    payload += format(
        "26",
        format("00", "BR.GOV.BCB.PIX") +
        format("01", chave)
    );
    payload += format("52", "0000");
    payload += format("53", "986");
    payload += format("54", valorFormatado);
    payload += format("58", "BR");
    payload += format("59", nome);
    payload += format("60", cidade);
    payload += format("62", format("05", "***"));
    payload += "6304";
    payload += crc16(payload);

    return payload;
}

async function gerarQrCodeBase64(textoPix) {
    return await QRCode.toDataURL(textoPix, {
        width: 400,
        margin: 2
    });
}

function normalizeLojas(lojas) {
    if (!lojas) return [];           // null ou undefined
    if (Array.isArray(lojas)) return lojas;  // já é array, mantém
    if (typeof lojas === 'object') { 
        // transforma objeto numerado em array plano
        return Object.keys(lojas)
            .sort((a,b) => Number(a) - Number(b)) // garante ordem correta
            .map(key => lojas[key]);
    }
    return [];  // qualquer outro tipo inválido
}

async function enviarTelegram(texto) {

    const lojaId = localStorage.getItem('selecaoLoja');

    const token = '8742555869:AAFTCmylSRPMr0MWxutQ8wex3E_zcvR4R04';
    let chatId = '';
    let chavePix = ''

    const db = firebase.firestore();
    const snapshot = await db.collection("users").get();

    snapshot.forEach((doc) => {
        const usuario = doc.data();

        // normaliza lojas
        const lojasArray = normalizeLojas(usuario.lojas);

        lojasArray.forEach(loja => {
            if (loja.idLoja !== lojaId) return;
            chatId = dadosLoja[0].chatID;
            chavePix = usuario.pix
        });
    });

    // valida chatId antes de enviar
    if (!chatId) {
        console.error("Nenhum chatId válido encontrado. Abortando envio.");
        return;
    }

    // valida texto
    if (!texto || typeof texto !== 'string') {
        return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
        const resposta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: texto })
        });

        const dados = await resposta.json();
        return dados;
    } catch (erro) {
        console.error("Erro ao enviar mensagem:", erro);
        throw erro;
    }
}

async function enviarTelegramImagem(base64Image, legenda = "QR Code Pix") {
    const lojaId = localStorage.getItem('selecaoLoja')

    const token = '8742555869:AAFTCmylSRPMr0MWxutQ8wex3E_zcvR4R04'
    let chatId = dadosLoja[0].chatID

    const url = `https://api.telegram.org/bot${token}/sendPhoto`;

    try {
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("caption", legenda);

        const blob = await (await fetch(base64Image)).blob();
        formData.append("photo", blob, "qrcode-pix.png");

        const resposta = await fetch(url, {
            method: "POST",
            body: formData
        });

        const dados = await resposta.json();
        return dados;
    } catch (erro) {
        console.error("Erro ao enviar imagem:", erro);
        throw erro;
    }
}

guardarDados()