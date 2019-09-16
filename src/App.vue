<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<script>
  export default {}
  document.addEventListener('DOMContentLoaded', () => {
    // 根据屏幕宽度动态计算fontSize
    let fontSize = window.innerWidth / 10
    // 当fontSize大于50时，设置最大值为50
    fontSize = fontSize > 50 ? 50 : fontSize
    // 获取html元素
    const html = document.querySelector('html')
    html.style.fontSize = fontSize + 'px'
  })
</script>

<style scoped>
  #app {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    background: #7d8188;
    overflow: hidden;
  }
</style>
