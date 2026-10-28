import "@fontsource/fira-code"
import { Check } from "@mui/icons-material"
import CloseIcon from "@mui/icons-material/Close"
import MenuIcon from "@mui/icons-material/Menu"
import {
  AppBar,
  Button,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Snackbar,
  SnackbarCloseReason,
  Toolbar,
  Typography,
} from "@mui/material"
import React from "react"

export default function BlehajAppBar({
  noWaitMode,
  setNoWaitMode,
}: {
  noWaitMode: boolean
  setNoWaitMode: React.Dispatch<React.SetStateAction<boolean>>
}) {
  const [noReadingSnackbar, setNoReadingSnackbar] = React.useState(false)

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = (
    event: React.SyntheticEvent | Event,
    reason?:
      SnackbarCloseReason | "backdropClick" | "escapeKeyDown" | "tabKeyDown"
  ) => {
    setAnchorEl(null)
    if (reason === "clickaway") {
      return
    }

    setNoReadingSnackbar(false)
  }

  const clickNoReading = () => {
    if (noWaitMode) {
      setNoWaitMode(false)
      setNoReadingSnackbar(false)
    } else {
      setNoWaitMode(true)
      setNoReadingSnackbar(true)
    }
    setAnchorEl(null)
  }

  const action = (
    <React.Fragment>
      <Button color="secondary" size="small" onClick={clickNoReading}>
        UNDO
      </Button>
      <IconButton
        size="small"
        aria-label="close"
        color="inherit"
        onClick={handleClose}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </React.Fragment>
  )

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h1" sx={{ flexGrow: 1, pt: 1 }}>
          🦈
        </Typography>
        <Typography variant="h3">blehaj</Typography>
        <div>
          <IconButton
            size="large"
            edge="end"
            color="inherit"
            aria-label="menu"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenu}
            sx={{ ml: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            keepMounted
            anchorOrigin={{
              vertical: "center",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "left",
            }}
            open={Boolean(anchorEl)}
            onClose={handleClose}
          >
            <MenuItem onClick={clickNoReading}>
              <ListItemIcon>
                {noWaitMode ? <Check fontSize="small" /> : null}
              </ListItemIcon>
              No Wait Mode
            </MenuItem>
          </Menu>
        </div>
      </Toolbar>
      <Snackbar
        open={noReadingSnackbar}
        onClose={handleClose}
        message="'No Wait Mode' means that the UI will not give you a chance to read events which happen quickly."
        action={action}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{ boxShadow: 5 }}
      />
    </AppBar>
  )
}
