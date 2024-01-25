const makeWaSocket = require('@adiwajshing/baileys').default
const { DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, delay } = require('@adiwajshing/baileys')
const P = require('pino')
const { unlink } = require('fs')
const fs = require('fs')
const { Configuration, OpenAIApi } = require('openai')

const configuration = new Configuration({
    organization: 'org-bF1InAGfqP55wZDzGAu4NHlE',
    apiKey: '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',
});

const openai = new OpenAIApi(configuration);

const zarekGroupCheck = (jid) => {
    const regexp = new RegExp(/^\d{18}@g.us$/)
    return regexp.test(jid)
 }

const zarekUpdate = (zareksock) => {
   zareksock.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr){
         console.log('© BOT-zarek - Qrcode: ', qr);
      };
      if (connection === 'close') {
         const zarekReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
         if (zarekReconnect) zarekConnection();
         console.log(`© BOT-zarek - CONEXÃO FECHADA! RAZÃO: ` + DisconnectReason.loggedOut.toString());
         if (zarekReconnect === false) {
            fs.rmSync('zarek', { recursive: true, force: true });
            const removeAuth = 'zarek';
            unlink(removeAuth, err => {
               if (err) throw err;
            })
         }
      }
      if (connection === 'open'){
         console.log('© BOT-zarek - CONECTADO')
      }
   })
}

console.log("\n A Projeto de Mestrado IFBA Campus Salvador. Para conversar pelo whatsapp digite /botzarek andes do testo ( /botzarek conta uma piada. )")
console.log("\n Alessandro Souza Silva\n")

const zarekConnection = async () => {

    const { version } = await fetchLatestBaileysVersion()
    const { state, saveCreds } = await useMultiFileAuthState('zarek')

    const config = {
        auth: state,
        logger: P({ level: 'error' }),
        printQRInTerminal: true,
        generateHighQualityLinkPreview: true,
        syncFullHistory: true,
        keepAliveIntervalMs: 5000,
        version,
        connectTimeoutMs: 60_000,
        emitOwnEvents: false,
        async getMessage(key) {
            return { conversation: key };
        },
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(message.buttonsMessage || message.listMessage || message.templateMessage );
            if (requiresPatch) {
            message = {
                viewOnceMessageV2: {
                message: {
                    messageContextInfo: {
                    deviceListMetadataVersion: 2,
                    deviceListMetadata: {},
                    },
                    ...message,
                },
                },
            };
            }
            return message;
        },
    }
    
    const zareksock = makeWaSocket(config, { auth: state });
    zarekUpdate(zareksock.ev);
    zareksock.ev.on('creds.update', saveCreds);

    const zarekSendMessage = async (jid, msg) => {
            await zareksock.presenceSubscribe(jid)
            await delay(2000)
            await zareksock.sendPresenceUpdate('composing', jid)
            await delay(1500)
            await zareksock.sendPresenceUpdate('paused', jid)
            return await zareksock.sendMessage(jid, msg)
    }
    
    const getDavinciResponse = async (clientText) => {
        const options = {
            model: "text-davinci-003", // Modelo GPT a ser usado
            prompt: clientText, // Texto enviado pelo usuário
            temperature: 1, // Nível de variação das respostas geradas, 1 é o máximo
            max_tokens: 4000 // Quantidade de tokens (palavras) a serem retornadas pelo bot, 4000 é o máximo
        }
    
        try {
            const response = await openai.createCompletion(options)
            let botResponse = ""
            response.data.choices.forEach(({ text }) => {
                botResponse += text
            })
            return ` Usando *BOT-ZAREK* 🤖\n\n ${botResponse.trim()}`
        } catch (e) {
            return `❌ Servidor sobrecarregado por favor tente Novamente: ${e.response.data.error.message}`
        }
    }
    
    const getDalleResponse = async (clientText) => {
        const options = {
            prompt: clientText, // Descrição da imagem
            n: 1, // Número de imagens a serem geradas
            size: "1024x1024", // Tamanho da imagem
        }
    
        try {
            const response = await openai.createImage(options);
            return response.data.data[0].url
        } catch (e) {
            return `❌ Servidor sobrecarregado por favor tente Novamente: ${e.response.data.error.message}`
        }
    }
    
    zareksock.ev.on('messages.upsert', async ({ messages, type }) => {
        const msg = messages[0]
        const zarekUsuario = msg.pushName;
        const jid = msg.key.remoteJid
        if (!msg.key.fromMe && jid !== 'status@broadcast' && !zarekGroupCheck(jid)) {
            console.log("© BOT-zarek - MENSAGEM : ", msg)
            zareksock.readMessages(msg.key.id)
            const msgChatGPT = msg.message.conversation;
            // mensagem de texto
            if (msgChatGPT.includes('/botzarek ')) {
                const index = msgChatGPT.indexOf(" ");
                const question = msgChatGPT.substring(index + 1);
                getDavinciResponse(question).then((response) => {
                    zarekSendMessage(jid, { text: zarekUsuario + response })
                    .then(result => console.log('RESULT: ', result))
                    .catch(err => console.log('ERROR: ', err))
                })
            }
            // imagem
            if (msgChatGPT.includes('/imgzarek ')) {
                const index = msgChatGPT.indexOf(" ");
                const imgDescription = msgChatGPT.substring(index + 1);
                getDalleResponse(imgDescription, msg).then((imgUrl) => {
                    const zarekImagem = {
                        caption: imgDescription,
                        image: {
                            url: imgUrl,
                        }
                    }
                    zarekSendMessage(jid, zarekImagem)
                        .then(result => console.log('RESULT: ', result))
                        .catch(err => console.log('ERROR: ', err))
                })
            }
        }
    })
  
}

zarekConnection() 