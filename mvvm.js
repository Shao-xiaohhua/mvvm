
// Object.defineProperty 使用方法;

// (function () {
//   let obj = {};

//   let song = '发如雪';

//   obj.singer = '周杰伦';

//   Object.defineProperty(obj, 'music', {
//     // 1. value: '七里香',
//     configurable: true, // 2. 可以配置对象，删除属性
//     // writable： true, // 3. 可以修改对象
//     enumerable: true, // 可以枚举
//     // * get, ser设置时不能设置writable和value, 它们代替了二者且是互相排斥的。
//     get () { // 5. 获取obj.music的时候就会调用get方法
//       console.log('获取')
//       return song;
//     },
//     set (val) { // 6. 将修改的值重新赋予给song
//       song = val;
//       console.log('设置');
//     }
//   });
//   console.log('开始');
//   console.log(obj.music)
//   obj.music = '123'
// })();


// 首先创建一个构造函数 ， 使用es6语法给options赋值 等同于 options || {}
function Mvvm (options = {}) {
  // vm.$options Vue上是将所有属性挂在到了$options上面
  // 所以我们也同样实现，将所有属性挂在到$options上面
  this.$options = options;
  let data = this._data = this.$options.data;

  // 数据劫持
  Observe(data);

  // 数据代理
  for (let key in data) {
    Object.defineProperty (this, key, {
      configurable:  true,
      get () {
        return this._data[key]; // 如this.a = {b : 1}
      },
      set (newVal) {
        this._data[key] = newVal;
      }
    });
  }

  // 编译
  new Compile(options.el, this);
};

// 因为每次赋予一个新的对象时会给这个新增对象增加defineProperty(数据劫持)
function Observe (data) {
  let dep = new Dep();
  // 所谓数据劫持就是给对象增加get, set
  // 先便利边对象
  for (let key in data) { // 把data属性通过defineProperty定义一便
    let val = data[key];
    _Observe(val); // 递归的方式继续向下找，实现深度数据劫持
    Object.defineProperty(data, key, {
      configurable:  true,
      get () {
        Dep.target && dep.addSub(Dep.target); // 将watcher添加到订阅事件中 [watcher]
        return val;
      },
      set (newVal) {
        if (val === newVal) { // 设置的值和以前一样不理他
          return;
        }
        val = newVal; // 如果以后再取值get的时候，将刚才设置的值再返回去
        _Observe(newVal); // 当设置为新值后，也需要把新值再去定义成属性
        dep.notify(); // 让所有watcher的update方法执行一遍
        console.log('mvvm设置, value:' + newVal);
      }
    })
  }
};

// 外面再写一个函数
// 不用每次都调用new
// 也方便递归调用
function _Observe (data) {
  // 如果不是对象的话就直接return掉
  // 防止递归溢出
  if (!data || typeof data !== 'object') return;
  return new Observe(data);
}

// 数据编译 {{}}
// 创建 Compile 构造函数
function Compile (el, vm) {
  // 将 el 挂在到实力上方便调用
  vm.$el = document.querySelector(el);
  // 在 el 范围里将内容都拿到，当然不能一个一个拿
  // 可以选择存道内存中 然后放入文档碎片中，节省开销
  let fragment = document.createDocumentFragment();
  while (child = vm.$el.firstChild) {
    fragment.appendChild(child); // 此时将 el 中的内容放入内存中
  }

  // 对 el 里面的内容进行替换
  function replace (frag) {
    Array.from(frag.childNodes).forEach(node => {
      let txt = node.textContent;
      let reg = /\{\{(.*?)\}\}/g; // 正则匹配{{}}

      if (node.nodeType === 3 && reg.test(txt)) { // 即是文本节点又有大括号的情况{{}}
        // console.log(RegExp.$1); // 匹配到的第一个分组如： a.b, c
        let arr = RegExp.$1.split('.'); // 变成数组
        let val = vm;
        arr.forEach(key => {
          val = val[key]; // 如this.a.b
        });
        // 用trim方法去除一下首位空格
        node.textContent = txt.replace(reg, val).trim();
        // 监听变化
        // 给Watcher再添加两个参数，用来取新的值（newVal）给回调函数传参
        new Watcher(vm, RegExp.$1, newVal => {
          node.textContent = txt.replace(reg, newVal).trim();
        });
      }
      // 数据双向绑定
      if (node.nodeType === 1) { // 元素节点
        let nodeAttr = node.attributes; // 获取dom上的所有属性,是个类数组
        Array.from(nodeAttr).forEach(attr => {
          let name = attr.name;   // v-model  type
          let exp = attr.value;   // c        text
          if (name.includes('v-')){
            node.value = vm[exp];   // this.c 为 2
          }
          // 监听变化
          new Watcher(vm, exp, function(newVal) {
            node.value = newVal;   // 当watcher触发时会自动将内容放进输入框中
          });
          node.addEventListener('input', e => {
            let newVal = e.target.value;
            // 相当于给this.c赋了一个新值
            // 而值的改变会调用set，set中又会调用notify，notify中调用watcher的update方法实现了更新
            vm[exp] = newVal;
          });
        });
      }
      // 如果还有子节点，继续递归replace
      if (node.childNodes && node.childNodes.length) {
        replace(node);
      }
    });
  }

  replace(fragment); // 替换内容

  vm.$el.appendChild(fragment); // 再将文档碎片放入el中
}

// 发布订阅模式， 订阅和发布， 如[fn1, fn2, fn3]
function Dep () {
  // 一个数组(存放函数和事件池)
  this.sub = [];
}
Dep.prototype = {
  addSub(sub) {
    this.sub.push(sub);
  },
  notify () {
    // 绑定的方法，都有一个update方法
    this.sub.forEach(sub => {
      sub.update();
    });
  }
};
// 监听函数
// 通过Watcher这个类创建的实例，都拥有update方法
// function Watcher(fn) {
//   this.fn = fn; // 将fn放到实例上
// }
// Watcher.prototype.update = function () {
//   this.fn();
// };


// 数据更新视图
// 现在我们要订阅一个事件，当数据改变需要重新刷新视图，这就需要在replace替换逻辑里来处理
// 通过new Watcher把数据订阅一下，数据一边就执行改变内容的操作 返回上面的replace --->

// 重写Watcher构造函数
function Watcher(vm, exp, fn) {
  this.fn = fn;
  this.vm = vm;
  this.exp = exp;
  // 添加一个事件
  // 这里我们先定义一个属性
  Dep.target = this;
  let arr = exp.split('.');
  let val = vm;
  arr.forEach(key => { // 取值
    val = val[key]; // 取到this.a.b,默认就会调用get方法
  });
  Dep.target = null;
}
// 当set修改值得时候执行了dep.notify方法，这个方法执行watcher的update方法，那么我们再对update方法进行修改一下
Watcher.prototype.update = function () {
  // notify的时候值已经更改了
  // 再通过vm， exp来获取新的值
  let arr = this.exp.split('.');
  let val = this.vm;
  arr.forEach(key => {
    val = val[key] // 通过get获取到的新的值
  });
  this.fn(val);
}
// 当获取值的时候就会自动调用get方法，于是我们去找一下数据劫持那里的get方法 ----> 上面
// let watcher = new Watcher(() => console.log(111));
// watcher.update();
// dep.addSub(watcher); // 将watcher放到数组中，watcher自带update方法，=> [watcher]
// dep.addSub(watcher);
// dep.notify(); // 111, 111
