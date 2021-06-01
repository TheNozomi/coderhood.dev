import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { serialize } from 'next-mdx-remote/serialize'

import { buildLessonStrings } from '@/lib/string'
import { getPathContent, githubFetchURL, getUrlContent } from '@/lib/github'

const root = process.cwd()

export async function getFolderContent(url) {
  return fs.readdirSync(path.join(root, 'public/data', url))
}

export async function getCompleteName(shortName, folder) {
  const content = await getFolderContent(folder)
  return content.find((m) => m.includes(shortName))
}

export async function getLesson(lessonURL, moduleURL) {
  const moduleName = await getCompleteName(moduleURL, 'academy')
  const lessonName = await getCompleteName(lessonURL, `academy/${moduleName}`)

  const lessonPath = `academy/${moduleName}/${lessonName}`
  const lessonContent = await getFolderContent(lessonPath)

  const mdx = await getMDX(`academy/${moduleName}/${lessonName}/readme.mdx`)

  const pdfAvailable = lessonContent.some((file) => file.includes('.pdf'))
  let pdfURL = null

  if (pdfAvailable) {
    pdfURL = await getPDF(moduleName, lessonName)
  }

  return { ...mdx, pdfURL }
}

export async function getLessons(moduleURL) {
  const moduleName = await getCompleteName(moduleURL, 'academy')
  const lessonsNames = await getFolderContent(`academy/${moduleName}`)

  const lessons = []
  for (const lesson of lessonsNames) {
    // don't include readme.mdx
    if (lesson.includes('.')) {
      continue
    }

    const lessonPath = `academy/${moduleName}/${lesson}`
    const lessonContent = await getFolderContent(lessonPath)

    // TODO: chequear si existe el archivo en github, no local
    // este chequeo local hace que si se accede a un pdf que no esta en github en local rompa
    if (lessonContent.includes('readme.mdx')) {
      const l = buildLessonStrings(lesson, `/academy/${moduleURL}`)
      lessons.push(l)
    }
  }

  return lessons // [{ url: string, title: string }]
}

export async function getPDF(moduleName, lessonName) {
  const url = `${process.env.REPO_URL}/contents/public/data/academy/${moduleName}/${lessonName}?ref=master`

  const lessonFiles = await fetch(url, {
    headers: { Authorization: `token ${process.env.GITHUB_OAUTH_TOKEN}` },
  }).then((r) => r.json())

  const { download_url } = lessonFiles.find(({ name }) => name.includes('.pdf'))

  return download_url
}

export async function getMDX(url) {
  const source = fs.readFileSync(path.join(root, 'public/data', url), 'utf8')

  const { data, content } = matter(source)
  const mdxSource = await serialize(content)

  return {
    mdxSource,
    frontMatter: {
      wordCount: content.split(/\s+/gu).length,
      ...data,
    },
  }
}
