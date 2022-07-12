<script context="module">
	export const prerender = true;
</script>

<script>
	import { onMount } from 'svelte';
	import Button, { Label } from '@smui/button';
	import Dialog, { Title, Content, Actions } from '@smui/dialog';
	import FormField from '@smui/form-field';
	import { Input } from '@smui/textfield';
	import Checkbox from '@smui/checkbox';

	// const BASE_URL = 'http://localhost:8929';
	const BASE_URL = 'http://quanye.org:8929';

	let Mim = null;
	let tim = null;

	let cloudAccounts = [];
	let account = '';
	let password = '';
	let token = '';
	let currentCloudAccount = {};
	let currentCloudGroups = [];

	let groups = [];
	let members = [];
	let group = '';
	let user1 = '';
	let user2 = '';
	let delayStart = 0;
	let delayEnd = 0;
	let enabled = true;
	let mMsgs = '';
	let isLogin = false;
	let connectState = 'disconnected';

	let argGroup = '';

	let searchValue = '';
	let searchUid = '';
	let addFriendDialogOpen = false;
	let addFriendRemark = '';
	let addFriendWording = '';
	let confirmSmsCode = false;
	let smsCode = '';

	function containGroupId(groupId) {
		return (
			currentCloudGroups.filter((g) => {
				if (g['group-id'] == groupId) {
					return true;
				}
			}).length > 0
		);
	}

	onMount(async () => {
		const mim = await import('../lib/mim.js');
		Mim = mim;
		tim = mim.getTim();
		// load account data
		loadCloudAccounts();
	});

	async function loginCheck(evt) {
		return await fetch(`${BASE_URL}/api/login-check/${account}/${password}`).then((res) => {
			return res.json();
		});
	}

	function onLoginHandler(evt) {
		loginCheck()
			.then((res) => {
				if (res.code == 200) {
					if (res.status) {
						doLogin();
					} else {
						// 有验证，需要输入验证码
						confirmSmsCode = true;
					}
				}
			})
			.catch((err) => {
				alert('网络错误');
			});
	}

	function doLogin(code = false) {
		let loginPromise;
		if (code) {
			loginPromise = fetch(`${BASE_URL}/api/do-login/${account}/${password}/${code}`);
		} else {
			loginPromise = fetch(`${BASE_URL}/api/do-login/${account}/${password}`);
		}
		loginPromise
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					token = res.data.token;
					tim.setLogLevel(4);
					tim
						.login({
							userID: res.data.userid,
							userSig: res.data.imtoken
						})
						.then((res) => {
							if (res.data.errorCode == 0) {
								// 登录成功
								if (res.data.repeatLogin === true) {
									// 重复登录
									alert('请勿重复登录');
								}
								tim.on(Mim.getTIM().EVENT.SDK_READY, onSdkReady);
							} else {
								console.error('login error: ', res.data.errorInfo);
							}
						})
						.catch((err) => {
							console.error('login error: ', err.message);
						});
				} else {
					alert(res.msg);
				}
			})
			.catch((err) => {
				alert(err.message);
			});
	}

	function onAccountDeleteHandler(evt) {}

	function onSdkReady(_evt) {
		isLogin = true;
		connectState = 'connected';
		// get group list
		getGroupList();
		// listen new message
		tim.on(Mim.getTIM().EVENT.MESSAGE_RECEIVED, (evt) => {
			if (evt.data != null && evt.data.length >= 1) {
				const msg = evt.data[0];
				const senderUserId = msg.from;
				const groupId = msg.to;
				const textMsg = msg.payload.text;
				if (textMsg != undefined && textMsg != null) {
					for (const group of currentCloudGroups) {
						const msgs = group.msgs.split('|');
						let line = null;
						if (msgs.length >= 2 && textMsg.includes(msgs[0])) {
							line = msgs;
						}
						let flag;
						if (
							(group['user-id1'] == null || group['user-id1'] == '') &&
							(group['user-id2'] == null || group['user-id2'] == '')
						) {
							flag = true;
						} else {
							if (group['user-id1'] == senderUserId || group['user-id2'] == senderUserId) {
								flag = true;
							} else {
								flag = false;
							}
						}
						if (flag && groupId == group['group-id'] && line != null && group['enabled']) {
							const delay =
								group['delay-start'] +
								Math.round(Math.random() * (group['delay-end'] - group['delay-start']));
							let index = Math.round(Math.random() * (line.length - 2)) + 1;
							setTimeout(() => {
								const message = tim.createTextMessage({
									to: groupId,
									conversationType: Mim.getTIM().TYPES.CONV_GROUP,
									priority: Mim.getTIM().TYPES.MSG_PRIORITY_HIGH,
									payload: {
										text: line[index]
									}
								});
								tim
									.sendMessage(message)
									.then((res) => {
										// sending successful
									})
									.catch((err) => {
										// sending take error
									});
							}, delay * 1000);
							break;
						}
					}
				}
			}
		});
		// listen on net-state-changed
		tim.on(Mim.getTIM().EVENT.NET_STATE_CHANGE, (evt) => {
			const types = Mim.getTIM().TYPES;
			if (types.NET_STATE_CONNECTED == evt.data.state) {
				// 已连接
				connectState = 'connected';
			} else if (types.NET_STATE_CONNECTING == evt.data.state) {
				// 连接中
				connectState = 'connecting';
			} else if (types.NET_STATE_DISCONNECTED == evt.data.state) {
				// 未连接
				connectState = 'disconnected';
			}
		});
	}

	function getGroupList() {
		tim
			.getGroupList()
			.then((res) => {
				if (res.code == 0) {
					groups = res.data.groupList;
					// group = '';
					// load currentCloudGroups
					loadCloudGroups();
				}
			})
			.catch((err) => {
				alert('获取群组失败，请重试:', err.message);
			});
	}

	function onGroupsSelectedHandle(evt, offset = 0) {
		if (!group.includes('λ')) {
			return;
		}
		const groupId = group.split('λ')[1];
		tim
			.getGroupMemberList({ groupID: groupId, count: 100, offset: offset })
			.then((res) => {
				if (res.code == 0) {
					// console.log('member-data', res.data);
					if (members.length > 0 && offset == 0) {
						members = [];
					}
					if (res.data.offset != 0) {
						members = members.concat(
							res.data.memberList.filter((val) => {
								return val['role'] == 'Admin' || val['role'] == 'Owner';
							})
						);
						onGroupsSelectedHandle(evt, offset + 100);
					} else {
						const groupName = group.split('λ')[0];
						const groupId = group.split('λ')[1];
						const currentGroup = currentCloudGroups.find((val) => {
							if (val['group-id'] == groupId) {
								return true;
							}
						});
						if (currentGroup != undefined) {
							// console.log(currentGroup);
							if (currentGroup['user-name1'] != null || currentGroup['user-name1'] != '') {
								user1 = `${currentGroup['user-name1']}λ${currentGroup['user-id1']}`;
							}
							if (currentGroup['user-name2'] != null || currentGroup['user-name2'] != '') {
								user2 = `${currentGroup['user-name2']}λ${currentGroup['user-id2']}`;
							}
							delayStart = currentGroup['delay-start'];
							delayEnd = currentGroup['delay-end'];
							enabled = currentGroup['enabled'];
							mMsgs = currentGroup['msgs'];
						} else {
							user1 = '';
							user2 = '';
							delayStart = 0;
							delayEnd = 0;
							enabled = true;
							mMsgs = '';
						}
					}
				}
			})
			.catch((err) => {
				alert('获取群成员失败，请重试:', err.message);
			});
	}
	function onDelayInputHandle(evt) {
		if (delayStart < 0) {
			delayStart = 0;
		}
		if (delayEnd < 0) {
			delayEnd = 0;
		}
	}

	function onSaveAccountToCloudHandler(evt) {
		fetch(`${BASE_URL}/api/save-account/${account}/${password}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					loadCloudAccounts();
					alert('保存账号成功');
				} else {
					alert('保存账号失败: ${res.msg}');
				}
			})
			.catch((err) => {
				alert('保存账号失败');
			});
	}

	function onSaveGroupHandler(evt) {
		const groupId = group.split('λ')[1];
		const groupName = group.split('λ')[0];
		const userName1 = user1.split('λ')[0];
		const userId1 = user1.split('λ')[1];
		const userName2 = user2.split('λ')[0];
		const userId2 = user2.split('λ')[1];
		const nowGroup = {
			account: account,
			'group-id': groupId,
			'group-name': groupName,
			'user-name1': userName1,
			'user-id1': userId1,
			'user-name2': userName2,
			'user-id2': userId2,
			'delay-start': delayStart,
			'delay-end': delayEnd,
			enabled: enabled,
			msgs: mMsgs
		};
		fetch(`${BASE_URL}/api/save-group`, {
			method: 'post',
			cache: 'no-cache',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(nowGroup)
		})
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					loadCloudGroups();
					alert(`保存成功`);
				} else {
					alert(`保存失败:${res.msg}`);
				}
			})
			.catch((err) => {
				alert(`保存失败`);
			});
	}
	function onDeleteGroupHandler(evt, groupId) {
		// const groupId = group.split('λ')[1];
		fetch(`${BASE_URL}/api/delete-group/${account}/${encodeURIComponent(groupId)}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					loadCloudGroups(true);
					alert('删除群组成功');
				} else {
					alert(`删除群组失败：${res.msg}`);
				}
			})
			.catch((err) => {
				alert('删除群组失败');
			});
	}

	function loadCloudGroups(reload = false) {
		fetch(`${BASE_URL}/api/get-groups-by-account/${account}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					currentCloudGroups = res.groups;
					if (currentCloudGroups.length > 0) {
						if (group == '' || reload) {
							const firstGroup = currentCloudGroups[0];
							group = `${firstGroup['group-name']}λ${firstGroup['group-id']}`;
						}
					} else {
						group = '';
					}
					// console.log(currentCloudGroups);
				}
			})
			.catch((err) => {
				alert('获取云端群组失败');
			});
	}
	function loadCloudAccounts() {
		fetch(`${BASE_URL}/api/get-accounts-all`, {
			method: 'get'
		})
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					cloudAccounts = res.accounts;
				}
			});
	}
	function onAccountInputHandler(evt) {
		fetch(`${BASE_URL}/api/get-account/${account}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					password = res.password;
				} else {
					password = '';
				}
			})
			.catch((err) => {
				password = '';
			});
	}

	function onLoadGroupArgumentsHandler(evt) {
		if (!argGroup.includes('λ')) {
			return;
		}
		const argGroupId = argGroup.split('λ')[1];
		const currentArgGroup = currentCloudGroups.find((g) => g['group-id'] == argGroupId);
		mMsgs = currentArgGroup['msgs'];
		delayStart = currentArgGroup['delay-start'];
		delayEnd = currentArgGroup['delay-end'];
		enabled = currentArgGroup['enabled'];
	}

	function onSearchUserHandler(evt) {
		if (token == '') {
			alert('请先登录');
			return;
		}
		fetch(`${BASE_URL}/api/do-search-user/${token}/${searchValue}`)
			.then((res) => {
				return res.json();
			})
			.then((res) => {
				if (res.code == 200) {
					if (res.type == 0) {
						alert(res.msg);
					} else {
						searchUid = res.data.uid;
					}
				} else {
					alert('查找用户失败');
					searchUid = '';
				}
			})
			.catch((err) => {
				alert('查找用户失败：' + err.message);
				searchUid = '';
			});
	}

	function onAddUserHandler(evt) {}

	$: if (account) {
		onAccountInputHandler(null);
	}
	$: if (group) {
		onGroupsSelectedHandle(null);
	}
	$: if (searchUid == '') {
		addFriendDialogOpen = false;
	} else {
		addFriendDialogOpen = true;
	}
</script>

<svelte:head>
	<title>潮流极购自动回复</title>
	<meta name="description" content="llkb" />
</svelte:head>

<form action="#">
	<label for="phoneNumber">
		<span>帐号：</span>
		<input
			type="text"
			name="phoneNumber"
			id="phoneNumber"
			bind:value={account}
			on:input={onAccountInputHandler}
		/>
		{#if isLogin}
			<span>已登录</span>
		{:else}
			<span>未登录</span>
		{/if}
		{#if connectState == 'disconnected'}
			<span>未连接</span>
		{:else if connectState == 'connecting'}
			<span>连接中...</span>
		{:else if connectState == 'connected'}
			<span>已连接</span>
		{/if}
	</label>
	<br />
	<label for="password">
		<span>密码：</span>
		<input type="text" name="password" id="password" bind:value={password} />
	</label>
	<br />
	<Button on:click={onLoginHandler} variant="outlined" color="secondary">
		<Label>登录</Label>
	</Button>
	<Button on:click={onSaveAccountToCloudHandler} variant="outlined" color="secondary">
		<Label>保存账号</Label>
	</Button>
	<Button on:click={onAccountDeleteHandler} variant="outlined" color="secondary">
		<Label>删除帐号</Label>
	</Button>
</form>

<hr />

搜索朋友：
<input type="text" placeholder="搜索诺呗号或手机号" bind:value={searchValue} />
<Button on:click={onSearchUserHandler} variant="outlined" color="secondary">
	<Label>搜索</Label>
</Button>
<!-- {#if searchUid != ''}{/if} -->
<Dialog
	bind:open={addFriendDialogOpen}
	aria-labelledby="add-friend-title"
	aria-describedby="add-friend-content"
	on:SMUIDialog:closed={(evt) => {
		if (evt.detail.action == 'ok') {
			// 提交添加好友申请
			tim
				.addFriend({
					to: searchUid,
					source: 'AddSource_Type_Android',
					remark: addFriendRemark,
					wording: addFriendWording
				})
				.then((res) => {
					const { code } = res.data;
					if (code == 0) {
						alert('添加成功');
					} else if (code == 30539) {
						alert('发送加友信息成功。对方设置了加友权限，您需要经过他的同意才能成功添加他为好友。');
					}
				})
				.catch((err) => {
					alert('添加朋友失败：' + err.message);
				});
		}
		searchUid = '';
	}}
>
	<Title id="add-friend-title">添加新朋友</Title>
	<Content id="add-friend-content">
		<div>
			加友备注（可空）：
			<FormField style="display: flex; flex-direction: column-reverse;">
				<Input type="text" placeholder="加友备注（可空）" bind:value={addFriendRemark} />
			</FormField>
		</div>
		<div>
			加友附言（可空）：
			<FormField style="display: flex; flex-direction: column-reverse;">
				<Input type="text" placeholder="加友附言（可空）" bind:value={addFriendWording} />
			</FormField>
		</div>
	</Content>
	<Actions>
		<Button action="cancel">
			<Label>取消添加</Label>
		</Button>
		<Button action="ok">
			<Label>确认添加</Label>
		</Button>
	</Actions>
</Dialog>
<br />

载入群组配置：
<select
	name="cloudGroups"
	id="cloudGroups"
	bind:value={argGroup}
	on:change={onLoadGroupArgumentsHandler}
>
	{#if isLogin}
		<option value="">下拉选择云端配置</option>
	{:else}
		<option value="">请先登录</option>
	{/if}
	{#each currentCloudGroups as g}
		<option value="{g['group-name']}λ{g['group-id']}">{g['group-name']}</option>
	{/each}
</select>
<Button
	on:click={(evt) => onDeleteGroupHandler(evt, argGroup.split('λ')[1])}
	variant="outlined"
	color="secondary"
>
	<Label>删除群组配置</Label>
</Button>
<br />

群组名：
<select name="groups" id="groups" bind:value={group} on:change={onGroupsSelectedHandle}>
	{#if groups.length == 0}
		<option value="">请先登录</option>
	{:else}
		<option value="">下拉选择群名</option>
	{/if}
	{#each groups as { groupID, name }}
		<option value="{name}λ{groupID}">{name}</option>
	{/each}
</select>
<Button on:click={(_evt) => getGroupList()} variant="outlined" color="secondary">
	<Label>刷新</Label>
</Button>
<Button on:click={onSaveGroupHandler} variant="outlined" color="secondary">
	<Label>保存群组</Label>
</Button>
<Button
	on:click={(evt) => onDeleteGroupHandler(evt, group.split('λ')[1])}
	variant="outlined"
	color="secondary"
>
	<Label>删除群组</Label>
</Button>
<br />

用户名1：
<select name="members1" id="members1" bind:value={user1}>
	{#if members.length == 0}
		<option value="">请先选择群组</option>
	{:else}
		<option value="">下拉选择群组</option>
	{/if}
	{#each members as { userID, nick }}
		<option value="{nick}λ{userID}">{nick}</option>
	{/each}
</select>
<Button on:click={(_evt) => (user1 = '')} variant="outlined" color="secondary">
	<Label>清空</Label>
</Button>
<br />

用户名2：
<select name="members1" id="members1" bind:value={user2}>
	{#if members.length == 0}
		<option value="">请先选择群组</option>
	{:else}
		<option value="">下拉选择群组</option>
	{/if}
	{#each members as { userID, nick }}
		<option value="{nick}λ{userID}">{nick}</option>
	{/each}
</select>
<Button on:click={(_evt) => (user2 = '')} variant="outlined" color="secondary">
	<Label>清空</Label>
</Button>

<br />
延迟秒：
<input
	type="number"
	name="delayStart"
	id="delayStart"
	bind:value={delayStart}
	on:input={onDelayInputHandle}
/>
-
<input
	type="number"
	name="delayEnd"
	id="delayEnd"
	bind:value={delayEnd}
	on:input={onDelayInputHandle}
/>
<br />

<FormField>
	<Checkbox name="enable" id="enable" bind:checked={enabled} />
	<span slot="label">启用</span>
</FormField>
<br />
<label for="msgs">
	消息内容：
	<br />
	<textarea name="msgs" id="msgs" cols="30" rows="10" bind:value={mMsgs} />
</label>
<br />

<Dialog
	bind:open={confirmSmsCode}
	aria-labelledby="code-input-title"
	aria-describedby="code-input-content"
	on:SMUIDialog:closed={(evt) => {
		if (evt.detail.action == 'ok') {
			doLogin(smsCode);
			confirmSmsCode = false;
		}
	}}
>
	<Title id="code-input-title">验证码验证</Title>
	<Content id="code-input-content">
		<div>
			<FormField style="display: flex; flex-direction: column-reverse;">
				<Input type="text" placeholder="短信验证码" bind:value={smsCode} />
			</FormField>
		</div>
	</Content>
	<Actions>
		<Button action="ok">
			<Label>确认</Label>
		</Button>
	</Actions>
</Dialog>

<style>
	input[type='number'] {
		width: 50px;
	}
</style>
