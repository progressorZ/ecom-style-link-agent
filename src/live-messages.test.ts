import {expect,test} from 'vitest'
import {explainLiveMessage} from './live-messages'
test('service mismatch names each differing promise and directs readback',()=>{
 const text=explainLiveMessage('SERVICES_REQUIRE_MANUAL_CORRECTION:'+JSON.stringify([{field:'nearbySameDay',expected:true,observed:false},{field:'authenticityPromise',expected:false,observed:true}]))
 expect(text).toContain('“周边区域当天发货及揽收”工作台为已勾选，商家页为未勾选')
 expect(text).toContain('“假一赔十”工作台为未勾选，商家页为已勾选')
 expect(text).toContain('核对商品')
 expect(explainLiveMessage('SERVICES_REQUIRE_MANUAL_CORRECTION')).not.toContain('SERVICES_REQUIRE')
 expect(explainLiveMessage('SERVICES_REQUIRE_MANUAL_CORRECTION:broken')).not.toContain('broken')
})
test('turns intercepted shop QR timeout into a short message',()=>{
 const text=explainLiveMessage('locator.click: Timeout 30000ms exceeded. Call log: \u001b[2m<div>店铺二维码</div> intercepts pointer events\u001b[22m')
 expect(text).toContain('顶部浮层遮挡')
 expect(text).not.toContain('Call log')
})
