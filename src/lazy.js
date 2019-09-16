import Vue from 'vue'
import lazyload from 'vue-lazyload'

Vue.use(lazyload, {
  error: require('@/assets/images/timg.jpg'),
  loading: require('@/assets/images/timg.jpg')
})
