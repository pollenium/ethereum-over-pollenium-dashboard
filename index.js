const wsProtocol = document.location.protocol === 'https:' ? 'wss' : 'ws'

const client = new pollenium.Client({
  signalingServerUrls: [
    `${wsProtocol}://begonia-us-1.herokuapp.com`,
    `${wsProtocol}://begonia-eu-1.herokuapp.com`,
  ],
  Worker: Worker,
  WebSocket: WebSocket,
  hashcashWorkerUrl: './lib/pollenium-anemone/hashcash-worker.js'
})
const applicationId = pollenium.Bytes.fromUtf8('eth.tx.0').getPaddedLeft(32)

const app = angular.module('app', ['yaru22.angular-timeago'])

class SignalingClientComponent {
  constructor($scope, signalingClient) {
    this.signalingClient = signalingClient
    this.$scope = $scope
    this.url = signalingClient.signalingServerUrl
    this.status = 'connecting'
    this.updateStatus()
  }
  getBgClass() {
    switch(this.status) {
      case 'connecting':
        return 'bg-warning'
      case 'connected':
        return 'bg-success'
      case 'failed':
        return 'bg-danger'
    }
  }
  async updateStatus() {
    this.status = await this.signalingClient.fetchConnection().then(() => {
      return 'connected'
    }).catch(() => {
      return 'failed'
    })
    this.$scope.$apply()
  }
}

class TransactionComponent {
  constructor($scope, rawTransaction) {
    this.$scope = $scope
    this.rawTransactionHex = rawTransaction.getHex()
    this.transaction = new ethereumjsTx.Transaction(this.rawTransactionHex)
    this.transactionHash = this.transaction.hash()
    this.transactionSerialized = this.transaction.serialize()
  }
}

function extractIpString(offer) {
  const sdp = offer.sdpb.getUtf8()
  const sdpLines = sdp.split('\r\n')
  const ipLine = sdpLines.find((sdpLine) => {
    return sdpLine.indexOf('c=') === 0
  })
  const ipLineParts = ipLine.split(' ')
  return ipLineParts[ipLineParts.length - 1]
}

class FriendshipComponent {
  constructor($scope, friendship) {
    this.$scope = $scope
    this.friendship = friendship
    this.friendship.on('status', (status) => {
      this.$scope.$apply()
    })
    this.updateIpString()
  }
  getBgClass() {
    switch(this.friendship.status) {
      case 0:
        return 'bg-default'
      case 1:
        return 'bg-warning'
      case 2:
        return 'bg-success'
      case 3:
        return 'bg-danger'
    }
  }
  async fetchIpString() {
    if (this.friendship.offer) {
      return extractIpString(this.friendship.offer)
    }
    const offer = await this.friendship.fetchOffer()
    return extractIpString(offer)
  }
  async updateIpString() {
    this.ipString = await this.fetchIpString()
    this.$scope.$apply()
  }
}

app.controller('Client', ($scope) => {
  $scope.clientNonceHex = client.nonce.getHex()
})

app.controller('SignalingServers', async function SignalingServersController($scope) {
  $scope.signalingClientComponents = client.signalingClients.map((signalingClient) => {
    return new SignalingClientComponent($scope, signalingClient)
  })
})

function getFriends() {
  return client.introverts.concat(client.extroverts)
}

app.controller('Friendships', async function SignalingServersController($scope) {

  $scope.friendshipComponents = []

  function setFriendshipComponents() {
    $scope.friendshipComponents = getFriends().filter((friendship) => {
      return friendship.status !== 0
    }).map((friendship) => {
      return new FriendshipComponent($scope, friendship)
    })
    $scope.$apply()
  }

  client.on('friendship', setFriendshipComponents)
  client.on('friendship.status', setFriendshipComponents)

})

app.controller('Transactions', ($scope) => {
  function setIsConnected() {
    $scope.isConnected = getFriends().filter((friendship) => {
      return friendship.status === 2
    }).length > 0
    $scope.$apply()
  }

  client.on('friendship', setIsConnected)
  client.on('friendship.status', setIsConnected)

  $scope.transactionComponents = []

  client.on('friendship.missive', (missive) => {
    if (!missive.applicationId.equals(applicationId)) {
      return
    }
    const transactionComponent = new TransactionComponent($scope, missive.applicationData)
    transactionComponent.receivedAt = new Date
    $scope.transactionComponents.push(transactionComponent)
    $scope.$apply()
  })
})

app.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  }
})

app.filter('hex', function() {
  return function(uint8Array) {
    if (!uint8Array) {
      return '0x'
    }
    const bytes = new pollenium.Bytes(uint8Array)
    return `0x${bytes.getHex()}`
  }
})
