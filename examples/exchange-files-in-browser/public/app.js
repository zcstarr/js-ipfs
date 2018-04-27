/* global self */
'use strict'

const $peers = document.querySelector('#peers')
const $peersList = $peers.querySelector('tbody')
const $logs = document.querySelector('#logs')
const $files = document.querySelector('#files')
const $fileHistory = document.querySelector('#file-history tbody')
const $multihashInput = document.querySelector('#multihash')
const $catButton = document.querySelector('#cat')
const $connectPeer = document.querySelector('#peer-input')
const $connectPeerButton = document.querySelector('#peer-btn')
const $body = document.querySelector('body')
const $idContainer = document.querySelector('.id-container')
const $addressesContainer = document.querySelector('.addresses-container')
const $allDisabledButtons = document.querySelectorAll('button:disabled')
const $allDisabledInputs = document.querySelectorAll('input:disabled')
const $allDisabledElements = document.querySelectorAll('.disabled')

let node
let info
let Buffer

/* ===========================================================================
   Start and stop the IPFS node
   =========================================================================== */

function start () {
  if (!node) {
    const options = {
      repo: 'ipfs-' + Math.random() + Date.now().toString(),
      config: {
        Addresses: {
          Swarm: [
            // '/dns4/wrtc-star.discovery.libp2p.io/tcp/443/wss/p2p-webrtc-star'
            '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
          ]
        }
      }
    }

    // IFDEV: To test with latest js-ipfs
    // const IPFS = require('ipfs')
    // node = new IPFS(options)
    // VEDIF

    // EXAMPLE
    node = new self.Ipfs(options)

    Buffer = node.types.Buffer

    node.once('start', () => node.id((err, id) => {
      if (err) { return onError(err) }

      info = id
      updateView('ready', node)
      setInterval(refreshPeerList, 1000)
      $peers.classList.add('waiting')
    }))
  }
}

function appendFile (name, hash, size, data) {
  const file = new window.Blob([data], { type: 'application/octet-binary' })
  const url = window.URL.createObjectURL(file)
  const row = document.createElement('tr')

  const nameCell = document.createElement('td')
  nameCell.innerHTML = name

  const hashCell = document.createElement('td')
  const link = document.createElement('a')
  link.innerHTML = hash
  link.setAttribute('href', url)
  link.setAttribute('download', name)
  hashCell.appendChild(link)

  const sizeCell = document.createElement('td')
  sizeCell.innerText = size

  row.appendChild(nameCell)
  row.appendChild(hashCell)
  row.appendChild(sizeCell)

  $fileHistory.insertBefore(row, $fileHistory.firstChild)
}

function getFile () {
  const cid = $multihashInput.value

  $multihashInput.value = ''

  if (!cid) { return console.log('no multihash was inserted') }

  node.files.get(cid, (err, files) => {
    if (err) { return onError(err) }

    files.forEach((file) => {
      if (file.content) {
        appendFile(file.name, cid, file.size, file.content)
      }
    })
  })
}

/* ===========================================================================
   Drag & Drop
   =========================================================================== */

function onDrop (event) {
  onDragExit()
  event.preventDefault()

  if (!node) {
    return onError('IPFS must be started before files can be added')
  }
  const dt = event.dataTransfer
  const filesDropped = dt.files

  function readFileContents (file) {
    return new Promise((resolve) => {
      const reader = new window.FileReader()
      reader.onload = (event) => resolve(event.target.result)
      reader.readAsArrayBuffer(file)
    })
  }

  const files = []
  for (let i = 0; i < filesDropped.length; i++) {
    files.push(filesDropped[i])
  }

  files.forEach((file) => {
    readFileContents(file)
      .then((buffer) => {
        node.files.add({
          path: file.name,
          content: Buffer.from(buffer)
        }, { wrap: true }, (err, filesAdded) => {
          if (err) { return onError(err) }

          $multihashInput.value = filesAdded[0].hash
          $logs.classList.add('success')
          $logs.innerHTML = `${file.name} added! Try to hit 'Fetch' button!`
        })
      })
      .catch(onError)
  })
}

/* ===========================================================================
   Network related functions
   =========================================================================== */

// Get peers from IPFS and display them

function connectToPeer (event) {
  event.target.disabled = true
  node.swarm.connect($connectPeer.value, (err) => {
    if (err) { return onError(err) }

    $connectPeer.value = ''

    setTimeout(() => {
      event.target.disabled = false
    }, 500)
  })
}

function refreshPeerList () {
  node.swarm.peers((err, peers) => {
    if (err) {
      return onError(err)
    }
    const peersAsHtml = peers
      .map((peer) => {
        if (peer.addr) {
          const addr = peer.addr.toString()
          if (addr.indexOf('ipfs') >= 0) {
            return addr
          } else {
            return addr + peer.peer.id.toB58String()
          }
        }
      })
      .map((addr) => {
        return '<tr><td>' + addr + '</td></tr>'
      }).join('')

    if (peers.length === 0) {
      $peers.classList.add('waiting')
    } else {
      $peers.classList.remove('waiting')
      $peersList.innerHTML = peersAsHtml
    }
  })
}

/* ===========================================================================
   UI functions
   =========================================================================== */

function onError (err) {
  let msg = 'An error occured, check the dev console'

  if (err.stack !== undefined) {
    msg = err.stack
  } else if (typeof err === 'string') {
    msg = err
  }

  $logs.classList.remove('success')
  $logs.innerHTML = msg
}

window.onerror = onError

function onDragEnter () {
  $files.classList.add('dragging')
}

function onDragExit () {
  $files.classList.remove('dragging')
}

/* ===========================================================================
   App states
   =========================================================================== */

const states = {
  ready: () => {
    const addressesHtml = info.addresses.map((address) => {
      return '<li><span class="address">' + address + '</span></li>'
    }).join('')
    $idContainer.innerText = info.id
    $addressesContainer.innerHTML = addressesHtml
    $allDisabledButtons.forEach(b => { b.disabled = false })
    $allDisabledInputs.forEach(b => { b.disabled = false })
    $allDisabledElements.forEach(el => { el.classList.remove('disabled') })
  }
}

function updateView (state, ipfs) {
  if (states[state] !== undefined) {
    states[state]()
  } else {
    throw new Error('Could not find state "' + state + '"')
  }
}

/* ===========================================================================
   Boot the app
   =========================================================================== */

const startApplication = () => {
  // Setup event listeners
  $files.addEventListener('dragenter', onDragEnter)
  $files.addEventListener('drop', onDrop)
  $files.addEventListener('dragleave', onDragExit)
  $catButton.addEventListener('click', getFile)
  $connectPeerButton.addEventListener('click', connectToPeer)

  start();
}

startApplication()
