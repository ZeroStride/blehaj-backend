import QrCodeTwoToneIcon from "@mui/icons-material/QrCodeTwoTone"
import {
  Alert,
  Container,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
} from "@mui/material"
import { useDevices } from "@yudiel/react-qr-scanner"
import { MuiMarkdown } from "mui-markdown"
import React from "react"

export function uuidOrUndefined(uuid: string | null | undefined) {
  if (uuid) {
    try {
      return BluetoothUUID.getService(uuid.toLowerCase())
    } catch {}
  }
  return undefined
}

export default function WelcomeAndUuidInput() {
  const uuidInput = React.useId()

  const devices = useDevices()
  const [showScanner, setShowScanner] = React.useState(false)
  const [error, setError] = React.useState(false)

  const welcomeText = `
  #### welcome
  Welcome to \`blehaj\`, a Zero-Trust configuration tool for your Raspberry
  Pi, Arduino, or any other device that needs internet configuration,
  but doesn't have a keyboard and/or display.
  <br/><br/>
  Want to get started? Enter a UUID from a device running \`blehaj\`${devices.length > 0 ? ", or use your camera to scan one." : ".<br/>If you use this on a device with a camera, it can scan barcodes!"}
` /*            <Container maxWidth="xs">
              <Scanner
                onScan={(result) => {
                  console.log(result)
                  for (var i = result.length - 1; i >= 0; i--) {
                    try {
                      parseUuid(result[i].rawValue)
                      send({
                        type: "input.serviceUuid",
                        serviceUuid: result[i].rawValue,
                      })
                      break
                    } catch {}
                  }
                }}
                sound={false}
              />
            </Container>*/
  return (
    <Container
      component="form"
      sx={{ textAlign: "right" }}
      action={(formData) => {
        const data = Object.fromEntries(formData.entries())
        const uuid = uuidOrUndefined(data.uuid)
        if (uuid) {
          // send({ type: "input.serviceUuid", serviceUuid: data.uuid })
        } else {
          setError(true)
        }
      }}
      noValidate
      autoComplete="off"
      autoCorrect="false"
    >
      <MuiMarkdown>{welcomeText}</MuiMarkdown>
      <FormControl sx={{ m: 1 }} variant="outlined" fullWidth>
        <InputLabel htmlFor={`${uuidInput}-input`}>Device UUID</InputLabel>
        <OutlinedInput
          onInput={() => {
            error && setError(false)
          }}
          name="uuid"
          id={`${uuidInput}-input`}
          type={"text"}
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                aria-label={"Scan QR Code"}
                onClick={() => setShowScanner(true)}
                onMouseDown={(e) => e.preventDefault()}
                onMouseUp={(e) => e.preventDefault()}
                edge="end"
              >
                {devices.length > 0 && <QrCodeTwoToneIcon />}
              </IconButton>
            </InputAdornment>
          }
          label="Service Uuid"
        />
        {error && (
          <Alert severity="error" variant="outlined" sx={{ mt: 1 }}>
            <MuiMarkdown>
              Invalid UUID format. This value needs to be either a full UUID, or
              a Bluetoooth Service value which is accepted by
              [BluetoothUUID.getService](https://developer.mozilla.org/en-US/docs/Web/API/BluetoothUUID/getService_static)
            </MuiMarkdown>
          </Alert>
        )}
      </FormControl>

      <input type="submit" hidden />
    </Container>
  )
}
