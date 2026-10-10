/** 날짜 표시 — 한국어. 서버·클라이언트 공용 (Asia/Seoul 고정으로 hydration 차이 방지). */
const dateFmt = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Seoul",
})
const dateTimeFmt = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Seoul",
})

export function formatDate(d: string | Date): string {
  return dateFmt.format(new Date(d))
}

export function formatDateTime(d: string | Date): string {
  return dateTimeFmt.format(new Date(d))
}

/** "방금 전", "5분 전", "3일 전" … 30일 넘으면 날짜. */
export function formatRelative(d: string | Date, now: Date = new Date()): string {
  const diff = Math.round((now.getTime() - new Date(d).getTime()) / 1000)
  if (diff < 60) return "방금 전"
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}일 전`
  return formatDate(d)
}

/** 남은 기간: "6일 남음" */
export function formatRemaining(d: string | Date, now: Date = new Date()): string {
  const diff = Math.round((new Date(d).getTime() - now.getTime()) / 1000)
  if (diff <= 0) return "만료됨"
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}분 남음`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 남음`
  return `${Math.ceil(diff / 86400)}일 남음`
}

/** 세션 IP 표시 — 루프백은 알아보기 쉽게. */
export function formatIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  // Better Auth 는 IPv6 를 /64 로 가린다 → ::1 이 0000:…:0000 으로 보인다.
  if (/^[0:]+$/.test(ip)) return "이 컴퓨터(localhost)"
  if (/^(::1|127\.|0{0,4}(:0{0,4}){6,7}:0{0,3}1$|::ffff:127\.)/i.test(ip)) return "이 컴퓨터(localhost)"
  return ip
}
