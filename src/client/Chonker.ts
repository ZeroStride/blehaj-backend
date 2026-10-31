import { decode as decodeMsgpack } from "@msgpack/msgpack"

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
