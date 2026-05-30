import { createTheme } from '@mui/material/styles'

export default createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#5B9BD5',      // ฟ้าหลัก
    },
    secondary: {
      main: '#A8D4F5',      // ฟ้าอ่อนๆ
    },
    background: {
      default: '#EEF6FD',   // พื้นหลังฟ้าอ่อนมาก
      paper: '#F5FBFF',     // การ์ดขาวแกมฟ้า
    },
    text: {
      primary: '#1A3A5C',   // ตัวอักษรน้ำเงินเข้ม
      secondary: '#4A7FA5', // ตัวอักษรฟ้ากลาง
    },
  },
  typography: {
    fontFamily: '"Nunito", "Prompt", sans-serif',
  },
})