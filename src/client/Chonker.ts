import {
  decode as decodeMsgpack,
  encode as encodeMsgpack,
} from "@msgpack/msgpack"

export async function readChonked(
  characteristic: BluetoothRemoteGATTCharacteristic,
  buffer?: Blob
): Promise<Blob> {
  return characteristic.readValue().then(function (value) {
    const raw = decodeMsgpack(value)
    const [flags, chonk] = raw as [number, Uint8Array]

    // Todo - Blob is really inelegant but oh well
    const blobPart = new Blob([chonk as BlobPart])

    if (flags & 1) {
      console.debug("this is first chonk")
    }

    if (!(flags & 2)) {
      console.debug("there are more chonks", chonk)
      return new Promise(function (resolve) {
        resolve(
          readChonked(
            characteristic,
            buffer ? new Blob([buffer, blobPart]) : blobPart
          )
        )
      })
    } else {
      console.debug("this was the last chonk", chonk)
      return Promise.resolve(buffer ? new Blob([buffer, blobPart]) : blobPart)
    }
  })
}

export async function writeChonked(
  data: ArrayBuffer,
  characteristic: BluetoothRemoteGATTCharacteristic
): Promise<void> {
  const bluetooth_mtu = 512
  const msgpack_headers = 6 // 1 for the flags, 1 for the buffer + 4 max for size of the buffer
  const chonk_size = bluetooth_mtu - 4 - 1 // It encodes the flags as a 32-bit value, so 4; but I have no idea where the extra byte is going

  var promiseChain = null
  var offset = 0
  const num_chonks = Math.ceil(data.byteLength / chonk_size)
  // console.log("chonking data", { num_chonks })
  for (var i = 0; i < num_chonks; i++) {
    var flags = 0
    if (i === 0) {
      flags |= 1 // Start of frame
    }
    if (i === num_chonks - 1) {
      flags |= 2 // End of frame
    }

    const len = Math.min(data.byteLength - offset, chonk_size)
    const slice = data.slice(offset, offset + len)
    offset += len
    var chonk = encodeMsgpack([flags, new Uint8Array(slice)])
    // console.log("pushing chonk", {
    //   chonk: i,
    //   len,
    //   flags,
    //   byteLength: chonk.byteLength,
    // })
    if (chonk.byteLength > bluetooth_mtu) {
      throw new Error(`messed up the math ${chonk.byteLength}`)
    }
    await characteristic.writeValueWithResponse(chonk)
  }
}
