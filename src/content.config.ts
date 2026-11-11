import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 作品集：一个文件 = 一个作品
 * 放在 src/content/works/ 下面，支持 Markdown 正文
 */
const works = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    /** 卡片上的一句话说明 */
    summary: z.string(),
    year: z.string(),
    role: z.string().optional(),
    tags: z.array(z.string()).default([]),
    /** 外链，有就显示「访问」 */
    link: z.string().url().optional(),
    /** 是否出现在首页精选 */
    featured: z.boolean().default(false),
    /** 排序，数字小的在前 */
    order: z.number().default(50),
    draft: z.boolean().default(false),
  }),
});

/**
 * 创意实验室：一个文件 = 一个实验 / 想法
 */
const lab = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lab' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    /** live = 已上线，building = 在做了，idea = 只有想法 */
    status: z.enum(['live', 'building', 'idea']).default('idea'),
    year: z.string().optional(),
    tags: z.array(z.string()).default([]),
    link: z.string().url().optional(),
    order: z.number().default(50),
    draft: z.boolean().default(false),
  }),
});

export const collections = { works, lab };
