<script setup lang="ts">
import { ArrowRight, Grid3X3, Heart, Image, ShieldCheck } from '@lucide/vue'
import { RouterLink } from 'vue-router'

const heroImage = `${import.meta.env.BASE_URL}images/crafted-gallery-hero.png`
const editorPreview = `${import.meta.env.BASE_URL}images/editor-preview.png`
</script>

<template>
  <div class="home-page">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy">
        <p class="eyebrow">BEAD PATTERN STUDIO</p>
        <h1 id="hero-title">
          <span>让美好的画面</span>
          <span>变成可以拼的图纸</span>
        </h1>
        <p class="lead">
          从照片到清晰色号，从灵感到真实作品。为拼豆创作者准备的专业转换、编辑与材料管理工具。
        </p>
        <div class="hero-actions">
          <RouterLink class="primary-link" to="/editor">
            开始生成图纸
            <ArrowRight :size="18" aria-hidden="true" />
          </RouterLink>
          <RouterLink class="text-link" to="/editor">进入编辑器</RouterLink>
        </div>
        <p class="hero-note">
          <ShieldCheck :size="16" aria-hidden="true" />
          本地处理图片与草稿，不上传你的创作
        </p>
      </div>

      <figure class="hero-visual">
        <img
          :src="heroImage"
          alt="木质画框中的柴犬拼豆作品、图纸卡片与拼豆材料"
          width="1600"
          height="820"
        />
        <figcaption>从图像、色号到可以落地的拼豆作品</figcaption>
      </figure>

      <aside class="trust-rail" aria-label="产品能力">
        <article>
          <span class="trust-icon"
            ><Image :size="21" aria-hidden="true"
          /></span>
          <div>
            <strong>完整保留轮廓</strong><small>智能裁切与细节保护</small>
          </div>
        </article>
        <article>
          <span class="trust-icon"
            ><Grid3X3 :size="21" aria-hidden="true"
          /></span>
          <div>
            <strong>真实 Mard 色号</strong><small>清晰图例与用量统计</small>
          </div>
        </article>
        <article>
          <span class="trust-icon"
            ><Heart :size="21" aria-hidden="true"
          /></span>
          <div>
            <strong>自由继续创作</strong><small>绘制、取色、选区与临摹</small>
          </div>
        </article>
      </aside>
    </section>

    <section class="story-section" aria-labelledby="story-title">
      <div class="section-heading">
        <p class="eyebrow">MADE FOR MAKERS</p>
        <h2 id="story-title">不只把图片变小，<br />而是把作品想清楚。</h2>
      </div>
      <div class="story-copy">
        <p>
          普通像素化只关心方格，拼豆图纸还要关心轮廓、品牌色号、底板尺寸和你手边真实拥有的豆子。
        </p>
        <p>
          拼豆工坊把转换、手工修图、材料统计和施工图放在同一个工作区，让每一步都有依据，也保留创作者最后的判断。
        </p>
      </div>
      <div class="story-metrics" aria-label="产品特点">
        <div><strong>221</strong><span>Mard 默认色号</span></div>
        <div><strong>3</strong><span>图纸显示模式</span></div>
        <div><strong>100%</strong><span>浏览器本地处理</span></div>
      </div>
    </section>

    <section class="editor-showcase" aria-labelledby="editor-title">
      <div class="showcase-copy">
        <p class="eyebrow">COMPLETE WORKSPACE</p>
        <h2 id="editor-title">一张图纸，完整做到可以开工。</h2>
        <p>
          裁切照片、调整颜色、临摹修正、建立选区、统计豆仓，再导出色块图、施工图与材料清单。
        </p>
        <ul>
          <li>保留 X / Y 坐标与底板分界</li>
          <li>选区形成后再填充，避免误操作</li>
          <li>实时统计已用、剩余与缺少数量</li>
        </ul>
        <RouterLink class="primary-link" to="/editor">
          打开图纸编辑器
          <ArrowRight :size="18" aria-hidden="true" />
        </RouterLink>
      </div>
      <div class="editor-preview">
        <img
          :src="editorPreview"
          alt="拼豆图纸编辑器界面，包含图片转换、画布、豆仓与临摹面板"
        />
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  width: min(1440px, 100%);
  margin: 0 auto;
  padding: 34px 52px 96px;
}

.hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 246px;
  align-items: stretch;
  min-height: 650px;
  overflow: hidden;
  /* border: 1px solid rgb(157 79 88 / 14%); */
  border-radius: 32px;
  /* background: var(--surface); */
  /* box-shadow: var(--shadow-large); */
}

.hero-copy {
  z-index: 2;
  grid-column: 1;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: min(52%, 540px);
  padding: 64px 42px 58px 54px;
}

.eyebrow {
  margin: 0 0 20px;
  color: var(--rose-strong);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.2em;
}

h1,
h2 {
  font-family: 'Cormorant Garamond', 'Noto Serif SC', serif;
  font-weight: 600;
  letter-spacing: -0.035em;
}

h1 {
  margin: 0;
  color: var(--text);
  font-size: clamp(3rem, 3.6vw, 3.4rem);
  line-height: 1.02;
}

h1 span {
  display: block;
  white-space: nowrap;
}

.lead {
  max-width: 410px;
  margin: 30px 0 0;
  color: var(--text-muted);
  font-size: 0.98rem;
  line-height: 1.85;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  margin-top: 34px;
}

.primary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 48px;
  padding: 12px 19px;
  border: 1px solid var(--gold-dark);
  border-radius: 13px;
  color: var(--text);
  background: var(--gold);
  box-shadow: 0 10px 24px rgb(134 102 18 / 18%);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
}

.primary-link:hover {
  background: #dfc05b;
  transform: translateY(-2px);
}

.text-link {
  border-bottom: 1px solid var(--text);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  text-decoration: none;
}

.hero-note {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 24px 0 0;
  color: var(--text-muted);
  font-size: 0.67rem;
  line-height: 1.5;
}

.hero-visual {
  position: relative;
  grid-column: 1;
  grid-row: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  background: #e9ddd0;
}

.hero-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 52% center;
}

.hero-visual::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgb(255 250 248 / 88%) 0%,
    rgb(255 250 248 / 58%) 24%,
    rgb(255 250 248 / 8%) 48%,
    transparent 62%
  );
  content: '';
  pointer-events: none;
}

.hero-visual figcaption {
  position: absolute;
  right: 20px;
  bottom: 20px;
  max-width: 230px;
  padding: 10px 13px;
  border: 1px solid rgb(255 255 255 / 60%);
  border-radius: 11px;
  color: var(--text);
  background: rgb(255 250 248 / 88%);
  box-shadow: 0 8px 24px rgb(45 52 54 / 14%);
  backdrop-filter: blur(10px);
  font-size: 0.66rem;
  line-height: 1.45;
}

.trust-rail {
  grid-column: 2;
  grid-row: 1;
  display: grid;
  align-content: center;
  gap: 0;
  padding: 34px 26px;
  background: #f9eeee;
}

.trust-rail article {
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 11px;
  padding: 26px 0;
  border-bottom: 1px solid rgb(45 52 54 / 10%);
}

.trust-rail article:last-child {
  border-bottom: 0;
}

.trust-icon {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border: 1px solid rgb(157 79 88 / 20%);
  border-radius: 50%;
  color: var(--rose-strong);
  background: var(--surface);
  box-shadow: var(--shadow-small);
}

.trust-rail div {
  display: grid;
  align-content: center;
  gap: 4px;
}

.trust-rail strong {
  color: var(--text);
  font-size: 0.75rem;
  line-height: 1.4;
}

.trust-rail small {
  color: var(--text-muted);
  font-size: 0.61rem;
  line-height: 1.55;
}

.story-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 72px;
  padding: 124px 5% 112px;
}

.section-heading h2,
.showcase-copy h2 {
  margin: 0;
  font-size: clamp(2.7rem, 4.7vw, 4.8rem);
  line-height: 0.98;
}

.story-copy {
  padding-top: 38px;
}

.story-copy p,
.showcase-copy > p {
  margin: 0 0 18px;
  color: var(--text-muted);
  line-height: 1.9;
}

.story-metrics {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: rgb(255 255 255 / 55%);
  box-shadow: var(--shadow-small);
}

.story-metrics div {
  display: grid;
  gap: 5px;
  padding: 28px 32px;
  border-right: 1px solid var(--border);
}

.story-metrics div:last-child {
  border-right: 0;
}

.story-metrics strong {
  color: var(--rose-strong);
  font-family: 'Cormorant Garamond', serif;
  font-size: 2.2rem;
}

.story-metrics span {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.editor-showcase {
  display: grid;
  grid-template-columns: minmax(280px, 0.7fr) minmax(520px, 1.3fr);
  gap: 46px;
  align-items: center;
  padding: 56px;
  border-radius: 30px;
  background: var(--sage-pale);
  box-shadow: var(--shadow-large);
}

.showcase-copy > p {
  margin-top: 24px;
}

.showcase-copy ul {
  display: grid;
  gap: 10px;
  margin: 24px 0 8px;
  padding: 0;
  color: var(--text);
  font-size: 0.76rem;
  line-height: 1.6;
  list-style: none;
}

.showcase-copy li::before {
  margin-right: 9px;
  color: var(--sage-dark);
  content: '—';
}

.editor-preview {
  overflow: hidden;
  border: 7px solid rgb(255 255 255 / 74%);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 24px 60px rgb(51 78 63 / 18%);
}

.editor-preview img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  object-position: top left;
}

@media (max-width: 1120px) {
  .home-page {
    padding: 26px 30px 72px;
  }

  .hero {
    grid-template-columns: minmax(0, 1fr) 225px;
    min-height: 540px;
  }

  .hero-copy {
    width: 58%;
    padding: 50px 30px 46px 42px;
  }

  h1 {
    font-size: clamp(2.6rem, 4.6vw, 3rem);
  }

  .trust-rail {
    padding: 26px 20px;
  }

  .hero-visual::after {
    background: linear-gradient(
      90deg,
      rgb(255 250 248 / 94%) 0%,
      rgb(255 250 248 / 72%) 34%,
      rgb(255 250 248 / 14%) 60%,
      transparent 76%
    );
  }

  .editor-showcase {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .home-page {
    padding: 18px 18px 56px;
  }

  .hero {
    grid-template-columns: 1fr;
    border-radius: 24px;
  }

  .hero-copy {
    grid-column: 1;
    grid-row: 1;
    width: 100%;
    padding: 52px 34px 42px;
    background: var(--surface);
  }

  h1 {
    font-size: clamp(2.7rem, 10vw, 4.5rem);
  }

  .hero-visual {
    grid-column: 1;
    grid-row: 2;
    min-height: 430px;
  }

  .hero-visual::after {
    display: none;
  }

  .trust-rail {
    grid-column: 1;
    grid-row: 3;
    grid-template-columns: 1fr;
    padding: 12px 30px;
  }

  .trust-rail article {
    border-right: 0;
    border-bottom: 1px solid rgb(45 52 54 / 10%);
  }

  .story-section {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 82px 14px 74px;
  }

  .story-copy {
    padding-top: 0;
  }

  .story-metrics {
    grid-column: auto;
  }

  .editor-showcase {
    gap: 34px;
    padding: 38px 28px;
    border-radius: 24px;
  }
}

@media (max-width: 520px) {
  .hero-copy {
    padding: 44px 24px 36px;
  }

  h1 {
    font-size: 2.25rem;
  }

  .hero-visual {
    min-height: 330px;
  }

  .hero-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .story-metrics {
    grid-template-columns: 1fr;
  }

  .story-metrics div {
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }

  .story-metrics div:last-child {
    border-bottom: 0;
  }

  .editor-showcase {
    padding: 34px 20px;
  }
}
</style>
