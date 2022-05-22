const express = require("express")
const server = express()
const fetch = require("node-fetch")

/* -------------------------------------------------- */

const getJSON = async (id) => {
    const redirect = await fetch(`https://fembed.com/v/${id}`).then(res => res.url.replace("/v/", "/api/source/"))
    const video = await fetch(redirect, { method: "POST" }).then(res => res.json())
    if (!video["success"]) return { success: false }
    return video
}

const getVideoURL = async (videoJSON) => {
    const data = []
    for (filedata of videoJSON) {
        data.push({
            file: filedata["file"],
            label: filedata["label"],
            type: filedata["type"]
        })
    }
    return data
}

const getFetchHeader = async (headers) => {
    const data = {}
    for (let [key, value] of headers) {
        data[key] = value
    }
    return data
}

/* -------------------------------------------------- */

server.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    return next()
})

server.get("/", async (req, res) => {
    return res.json({ success: true, github: "https://github.com/aeongdesu/fembed-video-api" })
})

server.get("/:id", async (req, res) => {
    const id = req.params.id
    return res.json(await getJSON(id))
})

server.get("/:id/player", async (req, res) => {
    const id = req.params.id
    const videoJSON = await getJSON(id)
    if (!videoJSON["success"]) return res.status(404).json({ success: false })
    res.json(videoJSON["player"])
})

server.get("/:id/video", async (req, res) => {
    const id = req.params.id
    const videoJSON = await getJSON(id)
    if (!videoJSON["success"]) return res.sendStatus(404)
    return res.json(videoJSON["data"])
})

server.get("/:id/video/:type", async (req, res) => {
    const id = req.params.id
    const type = req.params.type
    const videoJSON = await getJSON(id)
    if (!videoJSON["success"]) return res.sendStatus(404)
    const json = await getVideoURL(videoJSON["data"])
    for (video in json) {
        if (json[video].label === type + "p") {
            return await fetch(json[video].file, { headers: { range: req.headers.range } }).then(async response => {
                res.set(await getFetchHeader(response.headers))
                response.body.pipe(res.status(206))
                response.body.on('error', () => { })
            })
        }
    }
    return res.status(404).json({ success: false })
})

server.get("/:id/captions", async (req, res) => {
    const id = req.params.id
    const videoJSON = await getJSON(id)
    if (!videoJSON["success"]) return res.status(404).json({ success: false })
    res.json(videoJSON["captions"])
})

server.get("/:id/captions/:capid", async (req, res) => {
    const id = req.params.id
    const capid = req.params.capid
    const videoJSON = await getJSON(id)
    if (!videoJSON["success"]) return res.status(404).json({ success: false })
    const userid = videoJSON["player"].poster_file.match(/\d+/g)[0]
    for (caption in videoJSON["captions"]) {
        if (videoJSON["captions"][caption].id == capid) {
            const cap = videoJSON["captions"][caption]
            const file = await fetch(`https://fembed.com/asset/userdata/${userid}/caption/${cap.hash}/${cap.id}.${cap.extension}`).then(res => res.text())
            res.set("content-type", "text/plain")
            return res.send(file)
        }
    }
    return res.status(404).json({ success: false })
})

/* -------------------------------------------------- */

if (!process.env.DETA_RUNTIME) {
    server.listen(8080, () => {
        console.log("Example app listening at http://localhost:8080")
    })
}

module.exports = server