import CloseIcon from "@mui/icons-material/Close"
import QrCodeTwoToneIcon from "@mui/icons-material/QrCodeTwoTone"
import {
  Alert,
  Container,
  Dialog,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
} from "@mui/material"
import { Scanner, useDevices } from "@yudiel/react-qr-scanner"
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

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
}

export default function WelcomeAndUuidInput({
  onUuid,
}: {
  onUuid: (uuid: string, simulate?: boolean) => void
}) {
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
`
  return (
    <>
      <Dialog onClose={() => setShowScanner(false)} open={showScanner}>
        <DialogTitle sx={{ m: 0, p: 1 }}>Scan QR Code or Bar Code</DialogTitle>
        <IconButton
          aria-label="close"
          onClick={() => setShowScanner(false)}
          sx={(theme) => ({
            position: "absolute",
            right: 8,
            top: 8,
            color: theme.palette.grey[500],
          })}
        >
          <CloseIcon />
        </IconButton>
        <Container maxWidth="xs" sx={{ pb: 2 }}>
          <Scanner
            onScan={(result) => {
              for (var i = result.length - 1; i >= 0; i--) {
                // Try Uuid match first
                try {
                  const uuid = uuidOrUndefined(result[i].rawValue)
                  if (uuid) {
                    onUuid.call(null, uuid)
                    break
                  }
                } catch {}
                // Try matching if it's a URL that points to our current hostname
                try {
                  const url = new URL(result[i].rawValue)
                  if (url.host === window.location.host) {
                    const uuid = uuidOrUndefined(url.pathname.split("/")[1])
                    if (uuid) {
                      onUuid.call(null, uuid)
                      break
                    }
                  }
                } catch {}
              }
            }}
            sound={false}
          />
        </Container>
      </Dialog>
      <Container
        component="form"
        sx={{ textAlign: "right" }}
        action={(formData) => {
          const data = Object.fromEntries(formData.entries())
          const uuid = uuidOrUndefined(data.uuid)
          if (uuid) {
            onUuid.call(null, uuid)
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
                Invalid UUID format. This value needs to be either a full UUID,
                or a Bluetoooth Service value which is accepted by
                <a
                  href="https://developer.mozilla.org/en-US/docs/Web/API/BluetoothUUID/getService_static"
                  target="_blank"
                >
                  BluetoothUUID.getService
                </a>
              </MuiMarkdown>
            </Alert>
          )}
        </FormControl>

        <input type="submit" hidden />
      </Container>
    </>
  )
}
