import TIM from 'tim-js-sdk/tim-js-friendship.js';

// const TIM = (await import('tim-js-sdk')).default;
// 配置
let options = {
  SDKAppID: 1400692995
};
let tim = null;

export function getTim() {
  if (tim == null) {
    tim = TIM.create(options);
  }
  return tim;
}

export function getTIM() {
  return TIM;
}