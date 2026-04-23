export interface Bullet {
  text: string
  url: string
  imageUrl?: string
}

export interface Category {
  name: string
  bullets: Bullet[]
}

export interface Digest {
  date: string
  categories: Category[]
}
