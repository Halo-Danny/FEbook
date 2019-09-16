<template>
  <div class="book-speaking">
    <detail-title @back="back" ref="title"></detail-title>
    <scroll class="content-wrapper"
            :top="42"
            :bottom="scrollBottom"
            :ifNoScroll="disableScroll"
            @onScroll="onScroll"
            ref="scroll">
      <!-- 图书信息 -->
      <book-info :cover="cover"
                 :title="title"
                 :author="author"
                 :desc="desc"></book-info>
      <!-- 语音朗读 -->
      <div class="book-speak-title-wrapper">
        <div class="icon-speak-wrapper">
          <span class="icon-speak"></span>
        </div>
        <div class="speak-title-wrapper">
          <span class="speak-title">{{$t('speak.voice')}}</span>
        </div>
        <div class="icon-down-wrapper" @click="toggleContent">
          <span :class="{'icon-down2': !ifShowContent, 'icon-up': ifShowContent}"></span>
        </div>
      </div>
      <!-- 电子书的内容详情 -->
      <div class="book-detail-content-wrapper" v-show="ifShowContent">
        <div class="book-detail-content-list-wrapper">
          <div class="loading-text-wrapper" v-if="!this.navigation">
            <span class="loading-text">{{$t('detail.loading')}}</span>
          </div>
          <div class="book-detail-content-item-wrapper">
            <div class="book-detail-content-item" v-for="(item, index) in flatNavigation" :key="index"
                 @click="speak(item, index)">
              <!-- speak-playing组件是那个前面的有点类似动画效果的图标 -->
              <speak-playing v-if="playingIndex === index"
                             :number="5"
                             ref="speakPlaying"></speak-playing>
              <!-- 目录信息 -->
              <div class="book-detail-content-navigation-text" :class="{'is-playing': playingIndex === index}"
                   v-if="item.label">{{item.label}}
              </div>
            </div>
          </div>
        </div>
      </div>
      <audio @canplay="onCanPlay"
             @timeupdate="onTimeUpdate"
             @ended="onAudioEnded"
             ref="audio"></audio>
    </scroll>
    <bottom :chapter="chapter"
            :currentSectionIndex="currentSectionIndex"
            :currentSectionTotal="currentSectionTotal"
            :showPlay="showPlay"
            :isPlaying.sync="isPlaying"
            :playInfo="playInfo"
            @onPlayingCardClick="onPlayingCardClick"></bottom>
    <div class="book-wrapper">
      <div id="read"></div>
    </div>
    <!-- 点击播放后出现的播放面板 -->
    <speak-window :title="this.chapter ? this.chapter.label : ''"
                  :book="book"
                  :section="section"
                  :currentSectionIndex.sync="currentSectionIndex"
                  :currentSectionTotal="currentSectionTotal"
                  :isPlaying.sync="isPlaying"
                  :playInfo="playInfo"
                  @updateText="updateText"
                  ref="speakWindow"></speak-window>
    <toast :text="toastText" ref="toast"></toast>
  </div>
</template>

<script type="text/ecmascript-6">
  import DetailTitle from '../../components/detail/detaiTitle'
  import BookInfo from '../../components/detail/bookInfo'
  import Scroll from '../../components/Scroll'
  import SpeakPlaying from '../../components/speak/speakPlaying'
  import Bottom from '../../components/speak/speakBottom'
  import SpeakWindow from '../../components/speak/speakMask'
  import Toast from '../../components/shelf/toast'
  import { findBook, getCategoryName } from '../../utils/book'
  import { download, flatList } from '../../api/book'
  import { getLocalForage } from '../../utils/localForage'
  import { realPx } from '../../utils/utils'
  import Epub from 'epubjs'

  global.ePub = Epub

  export default {
    components: {
      DetailTitle,
      BookInfo,
      Scroll,
      SpeakPlaying,
      Bottom,
      SpeakWindow,
      Toast
    },
    computed: {
      // 音频当前播放的分钟数
      currentMinute() {
        const m = Math.floor(this.currentPlayingTime / 60)
        return m < 10 ? '0' + m : m
      },
      // 音频当前播放的秒数
      currentSecond() {
        const s = Math.floor(this.currentPlayingTime - parseInt(this.currentMinute) * 60)
        return s < 10 ? '0' + s : s
      },
      // 音频的总时长
      totalMinute() {
        const m = Math.floor(this.totalPlayingTime / 60)
        return m < 10 ? '0' + m : m
      },
      // 音频的总秒数
      totalSecond() {
        const s = Math.floor(this.totalPlayingTime - parseInt(this.totalMinute) * 60)
        return s < 10 ? '0' + s : s
      },
      // 音频的剩余分钟数
      leftMinute() {
        const m = Math.floor((this.totalPlayingTime - this.currentPlayingTime) / 60)
        return m < 10 ? '0' + m : m
      },
      // 音频的剩余秒数
      leftSecond() {
        const s = Math.floor((this.totalPlayingTime - this.currentPlayingTime) - parseInt(this.leftMinute) * 60)
        return s < 10 ? '0' + s : s
      },
      // 播放信息对象
      playInfo() {
        if (this.audioCanPlay) {
          return {
            currentMinute: this.currentMinute,
            currentSecond: this.currentSecond,
            totalMinute: this.totalMinute,
            totalSecond: this.totalSecond,
            leftMinute: this.leftMinute,
            leftSecond: this.leftSecond
          }
        } else {
          return null
        }
      },
      // 电子书的语种
      lang() {
        return this.metadata ? this.metadata.language : ''
      },
      // 当播放面板显示时，禁用滚动条（解决事件穿透问题）
      disableScroll() {
        if (this.$refs.speakWindow) {
          return this.$refs.speakWindow.visible
        } else {
          return false
        }
      },
      // 是否底部的播放面板
      showPlay() {
        return this.playingIndex >= 0
      },
      scrollBottom() {
        return this.showPlay ? 116 : 52
      },
      // 当前章节信息
      chapter() {
        return this.flatNavigation[this.playingIndex]
      },
      // 电子书摘要信息
      desc() {
        if (this.description) {
          return this.description.substring(0, 100)
        } else {
          return ''
        }
      },
      flatNavigation() {
        if (this.navigation) {
          return Array.prototype.concat.apply([], Array.prototype.concat.apply([], this.doFlatNavigation(this.navigation.toc)))
        } else {
          return []
        }
      },
      category() {
        return this.bookItem ? getCategoryName(this.bookItem.category) : ''
      },
      title() {
        return this.metadata ? this.metadata.title : ''
      },
      author() {
        return this.metadata ? this.metadata.creator : ''
      }
    },
    data() {
      return {
        bookItem: null,
        book: null,
        rendition: null,
        metadata: null,
        cover: null,
        navigation: null,
        description: null,
        ifShowContent: true,
        playingIndex: -1,
        paragraph: null,
        currentSectionIndex: null,
        currentSectionTotal: null,
        section: null,
        isPlaying: false,
        audio: null,
        audioCanPlay: false,
        currentPlayingTime: 0,
        totalPlayingTime: 0,
        playStatus: 0, // 0 - 未播放，1 - 播放中，2 - 暂停中
        toastText: '',
        isOnline: false
      }
    },
    methods: {
      onAudioEnded() {
        this.resetPlay()
        this.currentPlayingTime = this.$refs.audio.currentTime
        const percent = Math.floor((this.currentPlayingTime / this.totalPlayingTime) * 100)
        this.$refs.speakWindow.refreshProgress(percent)
      },
      onTimeUpdate() {
        this.currentPlayingTime = this.$refs.audio.currentTime
        const percent = Math.floor((this.currentPlayingTime / this.totalPlayingTime) * 100)
        this.$refs.speakWindow.refreshProgress(percent)
      },
      onCanPlay() {
        this.audioCanPlay = true
        this.currentPlayingTime = this.$refs.audio.currentTime
        this.totalPlayingTime = this.$refs.audio.duration
      },
      findBookFromList(fileName) {
        flatList().then(response => {
          if (response.status === 200) {
            const bookList = response.data.data.filter(item => item.fileName === fileName)
            if (bookList && bookList.length > 0) {
              this.bookItem = bookList[0]
              this.init()
            }
          }
        })
      },
      init() {
        const fileName = this.$route.query.fileName
        if (!this.bookItem) {
          this.bookItem = findBook(fileName)
        }
        if (this.bookItem) {
          getLocalForage(fileName, (err, blob) => {
            if (err || !blob) {
              // this.downloadBook(fileName)
              this.isOnline = true
              const opf = this.$route.query.opf
              if (opf) {
                this.parseBook(opf)
              }
            } else {
              this.isOnline = false
              this.parseBook(blob)
            }
          })
        } else {
          this.findBookFromList(fileName)
        }
      },
      downloadBook(fileName) {
        download(
          this.bookItem,
          () => {
            getLocalForage(fileName, (err, blob) => {
              if (err) {
                return
              }
              this.parseBook(blob)
            })
          })
      },
      parseBook(blob) {
        this.book = new Epub(blob)
        this.book.loaded.metadata.then(metadata => {
          this.metadata = metadata
        })
        if (this.isOnline) {
          this.book.coverUrl().then(url => {
            this.cover = url
          })
        } else {
          this.book.loaded.cover.then(cover => {
            this.book.archive.createUrl(cover).then(url => {
              this.cover = url
            })
          })
        }
        this.book.loaded.navigation.then(nav => {
          this.navigation = nav
        })
        this.display()
      },
      back() {
        this.$router.go(-1)
      },
      onScroll(offsetY) {
        if (offsetY > realPx(42)) {
          this.$refs.title.showShadow()
        } else {
          this.$refs.title.hideShadow()
        }
      },
      toggleContent() {
        this.ifShowContent = !this.ifShowContent
      },
      display() {
        const height = window.innerHeight * 0.9 - realPx(40) - realPx(54) - realPx(46) - realPx(48) - realPx(60) - realPx(44)
        this.rendition = this.book.renderTo('read', {
          width: window.innerWidth,
          height: height,
          method: 'default'
        })
        this.rendition.display()
      },
      doFlatNavigation(content, deep = 1) {
        const arr = []
        content.forEach(item => {
          item.deep = deep
          arr.push(item)
          if (item.subitems && item.subitems.length > 0) {
            arr.push(this.doFlatNavigation(item.subitems, deep + 1))
          }
        })
        return arr
      },
      // 点击目录任何一个条目时会去调用一个speak方法
      // 生成语音合成的文本信息
      // 点击目录调用的speak方法本质就是拿到文本
      speak(item, index) {
        // 重置播放状态
        this.resetPlay()
        // 播放条目，index就是目录的索引
        this.playingIndex = index
        this.$nextTick(() => {
          this.$refs.scroll.refresh()
        })
        if (this.chapter) {
          // 获取当前点击的章节信息
          this.section = this.book.spine.get(this.chapter.href)
          // 渲染章节
          this.rendition.display(this.section.href).then(section => {
            // 获取当前位置对象，拿到位置信息后，想找到当前渲染的页面到底要显示多少文本
            // 把文本内容拿到才能通过接口进行语音合成
            const currentPage = this.rendition.currentLocation()
            const cfibase = section.cfiBase
            const cfistart = currentPage.start.cfi.replace(/.*!/, '').replace(/\)/, '')
            const cfiend = currentPage.end.cfi.replace(/.*!/, '').replace(/\)/, '')
            this.currentSectionIndex = currentPage.start.displayed.page
            this.currentSectionTotal = currentPage.start.displayed.total
            // 合成cfi信息，cfi主要目的就是获取文本
            const cfi = `epubcfi(${cfibase}!,${cfistart},${cfiend})`
            // console.log(currentPage, cfi, cfibase, cfistart, cfiend)
            // 通过Book.getRange(cfi)方法获取指定片段的cfi对应的文本
            this.book.getRange(cfi).then(range => {
              // 获取章节片段的文本信息
              let text = range.toLocaleString()
              // 对文本信息进行过滤，去除其中的空格（注意是2个空格，1个空格是合理的）、换行符等特殊字符
              text = text.replace(/\s(2,)/g, '')
              text = text.replace(/\r/g, '')
              text = text.replace(/\n/g, '')
              text = text.replace(/\t/g, '')
              text = text.replace(/\f/g, '')
              // 更新语音合成的文本信息
              this.updateText(text)
            })
          })
        }
      },
      showToast(text) {
        this.toastText = text
        this.$refs.toast.show()
      },
      togglePlay() {
        if (!this.isPlaying) {
          if (this.playStatus === 0) {
            // 0表示未播放
            this.play()
          } else if (this.playStatus === 2) {
            // 状态为2是暂停中
            this.continuePlay()
          }
        } else {
          this.pausePlay()
        }
      },
      resetPlay() {
        if (this.playStatus === 1) {
          this.pausePlay()
        }
        this.isPlaying = false
        this.playStatus = 0
      },
      play() {
        this.createVoice(this.paragraph)
      },
      continuePlay() {
        this.$refs.audio.play().then(() => {
          this.$refs.speakPlaying[0].startAnimation()
          this.isPlaying = true
          this.playStatus = 1
        })
      },
      pausePlay() {
        this.$refs.audio.pause()
        this.$refs.speakPlaying[0].stopAnimation()
        this.isPlaying = false
        this.playStatus = 2
      },
      onPlayingCardClick() {
        this.$refs.speakWindow.show()
      },
      // 拿到speak中的文本之后，传给paragraph，这样我们在点击播放器的时候才能将我们这个paragraph传给我们的createVoice
      updateText(text) {
        this.paragraph = text
      },
      // 在线语音合成，这里是使用的原生ajax的实现方法
      createVoice(text) {
        const xmlhttp = new XMLHttpRequest()
        // 创建HTTP请求，同步接收结果，第三个参数false决定了是同步还是异步
        // 使用同步的原因是提高audio的兼容性，在苹果中audio必须是同步的
        xmlhttp.open('GET', `${process.env.VUE_APP_VOICE_URL}/voice?text=${text}&lang=${this.lang.toLowerCase()}`, false)
        // 发送请求
        xmlhttp.send()
        // 将响应内容传入到xmlDoc中
        const xmlDoc = xmlhttp.responseText
        if (xmlDoc) {
          // 解析响应内容
          const json = JSON.parse(xmlDoc)
          if (json.path) {
            // path为语音合成生成的MP3文件下载路径，将该路径赋值audio.src
            // audio控件会自动加载音频文件
            this.$refs.audio.src = json.path
            // 自动播放MP3
            this.continuePlay()
          } else {
            this.showToast('播放失败，未生成链接')
          }
        } else {
          this.showToast('播放失败')
        }
        // 采用axios的异步方法就无法在苹果的浏览器中启动播放器
        /*axios.create({
          baseURL: process.env.VUE_APP_VOICE_URL + '/voice'
        })({
          method: 'get',
          params: {
            text: text,
            lang: this.lang.toLowerCase()
          }
        }).then(response => {
          if (response.status === 200) {
            if (response.data.error === 0) {
              const downloadUrl = response.data.path
              console.log('开始下载...%s', downloadUrl)
              downloadMp3(downloadUrl, blob => {
                const url = window.URL.createObjectURL(blob)
                console.log(blob, url)
                this.$refs.audio.src = url
                this.continuePlay()
              })
            } else {
              this.showToast(response.data.msg)
            }
          } else {
            this.showToast('请求失败')
          }
        }).catch(err => {
          console.log(err)
          this.showToast('播放失败')
        })*/
      }
    },
    mounted() {
      this.init()
    }
  }
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
  @import "../../assets/styles/global";

  .book-speaking {
    font-size: px2rem(16);
    width: 100%;
    background: white;
    .content-wrapper {
      width: 100%;
      .book-speak-title-wrapper {
        display: flex;
        padding: px2rem(15);
        box-sizing: border-box;
        border-bottom: px2rem(1) solid #eee;
        .icon-speak-wrapper {
          flex: 0 0 px2rem(40);
          @include left;
          .icon-speak {
            font-size: px2rem(24);
            color: #999;
          }
        }
        .speak-title-wrapper {
          flex: 1;
          @include left;
          .speak-title {
            font-size: px2rem(16);
            font-weight: bold;
            color: #666;
          }
        }
        .icon-down-wrapper {
          flex: 0 0 px2rem(40);
          @include right;
          .icon-up {
            font-size: px2rem(12);
            color: #999;
          }
          .icon-down2 {
            font-size: px2rem(12);
            color: #999;
          }
        }
      }
      .book-detail-content-wrapper {
        width: 100%;
        border-bottom: px2rem(1) solid #eee;
        box-sizing: border-box;
        .book-detail-content-list-wrapper {
          padding: px2rem(10) px2rem(15);
          .loading-text-wrapper {
            width: 100%;
            .loading-text {
              font-size: px2rem(14);
              color: #999;
            }
          }
          .book-detail-content-item-wrapper {
            .book-detail-content-item {
              display: flex;
              padding: px2rem(15) 0;
              font-size: px2rem(14);
              line-height: px2rem(16);
              color: #333;
              border-bottom: px2rem(1) solid #eee;
              &:last-child {
                border-bottom: none;
              }
              .book-detail-content-navigation-text {
                flex: 1;
                width: 100%;
                @include ellipsis;
                &.is-playing {
                  color: $color-blue;
                  font-weight: bold;
                  margin-left: px2rem(10);
                }
              }
            }
          }
        }
      }
    }
    .book-wrapper {
      position: absolute;
      bottom: -100%;
      z-index: 100;
    }
  }
</style>
