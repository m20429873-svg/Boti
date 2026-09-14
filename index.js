require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");

// =====================================================
// TOKEN من Railway فقط
// =====================================================

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN غير موجود في Railway Variables");
  process.exit(1);
}

// =====================================================
// السيرفر
// =====================================================

const SERVER_NAME = "Velora ✔";
const SERVER_IP = "VELORA010.aternos.me:51685";

// =====================================================
// رتب الإدارة
// =====================================================

const STAFF_ROLES = [
  "Trial",
  "Helper",
  "Sr Helper",
  "Mod",
  "Sr Mod",
  "Jr Admin",
  "Admin",
  "Co Owner",
  "Hp Owner",
  "Owner"
];

// الراتب و Warn وطلب الاستاف من Sr Mod فما فوق
const SENIOR_STAFF_ROLES = [
  "Sr Mod",
  "Jr Admin",
  "Admin",
  "Co Owner",
  "Hp Owner",
  "Owner"
];

// =====================================================
// نقاط الترقية
// =====================================================

const RANK_POINTS = {
  Trial: 0,
  Helper: 50,
  "Sr Helper": 120,
  Mod: 250,
  "Sr Mod": 400,
  "Jr Admin": 600,
  Admin: 850,
  "Co Owner": 1200,
  "Hp Owner": 1700,
  Owner: 2500
};

// =====================================================
// البيانات
// =====================================================

const DATA_FILE = "./data.json";

let data = {
  guilds: {}
};

if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(
      fs.readFileSync(DATA_FILE, "utf8")
    );
  } catch {
    data = {
      guilds: {}
    };
  }
}

function saveData() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2)
  );
}

function getGuildData(guildId) {
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = {
      points: {},
      salary: {},
      tickets: {}
    };

    saveData();
  }

  return data.guilds[guildId];
}

// =====================================================
// البوت
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================================================
// الرتب
// =====================================================

function hasRole(member, roleName) {
  return member.roles.cache.some(
    role =>
      role.name.toLowerCase() ===
      roleName.toLowerCase()
  );
}

function isStaff(member) {
  return STAFF_ROLES.some(
    role => hasRole(member, role)
  );
}

function isSeniorStaff(member) {
  return SENIOR_STAFF_ROLES.some(
    role => hasRole(member, role)
  );
}

// =====================================================
// النقاط
// =====================================================

function getPoints(guildId, userId) {
  const guildData =
    getGuildData(guildId);

  return Number(
    guildData.points[userId] || 0
  );
}

function addPoints(
  guildId,
  userId,
  amount
) {
  const guildData =
    getGuildData(guildId);

  const oldPoints =
    Number(
      guildData.points[userId] || 0
    );

  const newPoints =
    Math.max(
      0,
      oldPoints + amount
    );

  guildData.points[userId] =
    newPoints;

  saveData();

  return newPoints;
}

// =====================================================
// الرتبة المستحقة
// =====================================================

function getRankByPoints(points) {

  let rank = "Trial";

  for (
    const roleName of STAFF_ROLES
  ) {

    if (
      points >=
      RANK_POINTS[roleName]
    ) {
      rank = roleName;
    }

  }

  return rank;
}

// =====================================================
// تحديث الرتبة
// =====================================================

async function updateStaffRank(member) {

  const points =
    getPoints(
      member.guild.id,
      member.id
    );

  const wantedRank =
    getRankByPoints(points);

  const wantedRole =
    member.guild.roles.cache.find(
      role =>
        role.name.toLowerCase() ===
        wantedRank.toLowerCase()
    );

  if (!wantedRole) return;

  for (
    const roleName of STAFF_ROLES
  ) {

    const oldRole =
      member.guild.roles.cache.find(
        role =>
          role.name.toLowerCase() ===
          roleName.toLowerCase()
      );

    if (
      oldRole &&
      oldRole.id !== wantedRole.id &&
      member.roles.cache.has(oldRole.id)
    ) {

      await member.roles
        .remove(oldRole)
        .catch(() => {});

    }
  }

  if (
    !member.roles.cache.has(
      wantedRole.id
    )
  ) {

    await member.roles
      .add(wantedRole)
      .catch(() => {});

  }
}

// =====================================================
// أوامر
// =====================================================

const commands = [

  new SlashCommandBuilder()
    .setName("ip")
    .setDescription("عرض IP السيرفر"),

  new SlashCommandBuilder()
    .setName("points")
    .setDescription("عرض نقاطك"),

  new SlashCommandBuilder()
    .setName("salary")
    .setDescription("استلام راتب الإدارة"),

  new SlashCommandBuilder()
    .setName("claim")
    .setDescription("استلام التكت"),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو")
    .addUserOption(option =>
      option
        .setName("member")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("reason")
        .setDescription("سبب التحذير")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("staffrequest")
    .setDescription("طلب حضور الإدارة"),

  new SlashCommandBuilder()
    .setName("setup-ticket")
    .setDescription("إنشاء لوحة التكت")

].map(command =>
  command.toJSON()
);

// =====================================================
// تسجيل الأوامر بدون CLIENT_ID و GUILD_ID
// =====================================================

async function registerCommands() {

  try {

    const rest =
      new REST({
        version: "10"
      }).setToken(TOKEN);

    const applicationId =
      client.user.id;

    console.log(
      "🔄 تسجيل أوامر Boti..."
    );

    await rest.put(
      Routes.applicationCommands(
        applicationId
      ),
      {
        body: commands
      }
    );

    console.log(
      "✅ تم تسجيل الأوامر Global"
    );

  } catch (error) {

    console.error(
      "❌ خطأ تسجيل الأوامر:",
      error
    );

  }
}

// =====================================================
// عند تشغيل البوت
// =====================================================

client.once(
  "ready",
  async () => {

    console.log(
      "================================="
    );

    console.log(
      `✅ Boti Online: ${client.user.tag}`
    );

    console.log(
      `🌐 ${SERVER_NAME}`
    );

    console.log(
      `IP: ${SERVER_IP}`
    );

    console.log(
      "================================="
    );

    await registerCommands();

    client.user.setPresence({

      activities: [
        {
          name:
            `${SERVER_NAME} | /ip`,
          type: 0
        }
      ],

      status: "online"

    });

  }
);

// =====================================================
// Anti Links + Anti Spam
// =====================================================

const lastMessage = new Map();

const LINK_REGEX =
  /(https?:\/\/|www\.|discord\.gg\/|discord\.com\/invite\/)/i;

client.on(
  "messageCreate",
  async message => {

    if (
      !message.guild ||
      message.author.bot
    ) {
      return;
    }

    const member =
      message.member;

    // الإدارة مستثناة
    const staff =
      isStaff(member);

    // =================================================
    // منع الروابط
    // =================================================

    if (
      LINK_REGEX.test(
        message.content
      ) &&
      !staff
    ) {

      await message.delete()
        .catch(() => {});

      const warning =
        await message.channel.send({
          content:
            `🚫 <@${message.author.id}> ممنوع إرسال الروابط في السيرفر.`
        });

      setTimeout(() => {
        warning.delete()
          .catch(() => {});
      }, 5000);

      return;
    }

    // =================================================
    // Anti Spam
    // 10 ثواني
    // =================================================

    if (!staff) {

      const now =
        Date.now();

      const last =
        lastMessage.get(
          message.author.id
        ) || 0;

      if (
        now - last < 10000
      ) {

        await message.delete()
          .catch(() => {});

        const warning =
          await message.channel.send({
            content:
              `⏳ <@${message.author.id}> انتظر **10 ثوانٍ** قبل إرسال رسالة أخرى.`
          });

        setTimeout(() => {
          warning.delete()
            .catch(() => {});
        }, 5000);

        return;
      }

      lastMessage.set(
        message.author.id,
        now
      );

    }

  }
);

// =====================================================
// التفاعلات
// =====================================================

client.on(
  "interactionCreate",
  async interaction => {

    // =================================================
    // الأزرار
    // =================================================

    if (interaction.isButton()) {

      // ===============================================
      // فتح تكت
      // ===============================================

      if (
        interaction.customId ===
        "open_ticket"
      ) {

        const guild =
          interaction.guild;

        const member =
          interaction.member;

        const guildData =
          getGuildData(
            guild.id
          );

        const existing =
          guild.channels.cache.find(
            channel =>
              channel.type ===
                ChannelType.GuildText &&
              channel.topic ===
                `ticket-owner:${member.id}`
          );

        if (existing) {

          return interaction.reply({

            content:
              `❌ لديك تكت مفتوحة بالفعل: ${existing}`,

            ephemeral: true

          });

        }

        let username =
          member.user.username
            .toLowerCase()
            .replace(
              /[^a-z0-9-_]/g,
              ""
            )
            .slice(0, 15);

        if (!username) {
          username = "user";
        }

        const channel =
          await guild.channels.create({

            name:
              `ticket-${username}`,

            type:
              ChannelType.GuildText,

            topic:
              `ticket-owner:${member.id}`,

            permissionOverwrites: [

              {
                id: guild.id,

                deny: [
                  PermissionsBitField.Flags.ViewChannel
                ]
              },

              {
                id: member.id,

                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.ReadMessageHistory
                ]
              }

            ]

          });

        // إعطاء الإدارة صلاحية رؤية التكت

        for (
          const roleName of STAFF_ROLES
        ) {

          const role =
            guild.roles.cache.find(
              r =>
                r.name.toLowerCase() ===
                roleName.toLowerCase()
            );

          if (role) {

            await channel.permissionOverwrites
              .create(
                role,
                {
                  ViewChannel: true,
                  SendMessages: true,
                  ReadMessageHistory: true
                }
              )
              .catch(() => {});

          }

        }

        guildData.tickets[
          channel.id
        ] = {

          ownerId:
            member.id,

          claimedBy:
            null,

          claimCount: {}

        };

        saveData();

        // منشن الإدارة العليا

        const mentions = [];

        for (
          const roleName of
          SENIOR_STAFF_ROLES
        ) {

          const role =
            guild.roles.cache.find(
              r =>
                r.name.toLowerCase() ===
                roleName.toLowerCase()
            );

          if (role) {

            mentions.push(
              `<@&${role.id}>`
            );

          }

        }

        const embed =
          new EmbedBuilder()

            .setTitle(
              `🎫 تكت الدعم | ${SERVER_NAME}`
            )

            .setDescription(

              `مرحباً <@${member.id}> 👋\n\n` +

              `تم فتح التكت الخاصة بك.\n\n` +

              `👤 **صاحب التكت:** <@${member.id}>\n\n` +

              `🛡️ سيتم الرد عليك من الإدارة.`

            );

        const buttons =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  "ticket_claim"
                )
                .setLabel(
                  "استلام التكت"
                )
                .setStyle(
                  ButtonStyle.Primary
                ),

              new ButtonBuilder()
                .setCustomId(
                  "ticket_close"
                )
                .setLabel(
                  "إغلاق التكت"
                )
                .setStyle(
                  ButtonStyle.Danger
                )

            );

        await interaction.reply({

          content:
            `✅ تم فتح تكتك: ${channel}`,

          ephemeral: true

        });

        await channel.send({

          content:
            `<@${member.id}>\n\n` +
            mentions.join(" "),

          embeds: [
            embed
          ],

          components: [
            buttons
          ]

        });

        return;
      }

      // ===============================================
      // Claim
      // ===============================================

      if (
        interaction.customId ===
        "ticket_claim"
      ) {

        const member =
          interaction.member;

        const channel =
          interaction.channel;

        if (!isStaff(member)) {

          return interaction.reply({

            content:
              "❌ هذا الزر للإدارة فقط.",

            ephemeral: true

          });

        }

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const ticket =
          guildData.tickets[
            channel.id
          ];

        if (!ticket) {

          return interaction.reply({

            content:
              "❌ هذه القناة ليست تكت.",

            ephemeral: true

          });

        }

        // صاحب التكت ممنوع

        if (
          ticket.ownerId ===
          member.id
        ) {

          return interaction.reply({

            content:
              "❌ لا يمكنك استلام التكت التي فتحتها.",

            ephemeral: true

          });

        }

        // إذا شخص آخر مستلمها

        if (
          ticket.claimedBy &&
          ticket.claimedBy !==
            member.id
        ) {

          return interaction.reply({

            content:
              `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,

            ephemeral: true

          });

        }

        if (
          !ticket.claimCount[
            member.id
          ]
        ) {

          ticket.claimCount[
            member.id
          ] = 0;

        }

        ticket.claimCount[
          member.id
        ]++;

        // أول Claim

        if (
          ticket.claimCount[
            member.id
          ] === 1
        ) {

          ticket.claimedBy =
            member.id;

          const points =
            addPoints(
              interaction.guild.id,
              member.id,
              3
            );

          await updateStaffRank(
            member
          );

          return interaction.reply({

            content:
              `✅ تم استلام التكت.\n\n` +
              `⭐ **+3 نقاط**\n` +
              `📊 نقاطك الآن: **${points}**`

          });

        }

        // Claim ثاني

        const points =
          addPoints(
            interaction.guild.id,
            member.id,
            -50
          );

        return interaction.reply({

          content:
            `⚠️ Claim ثاني لنفس التكت.\n\n` +
            `❌ **-50 نقطة**\n` +
            `📊 نقاطك الآن: **${points}**`

        });

      }

      // ===============================================
      // إغلاق التكت
      // ===============================================

      if (
        interaction.customId ===
        "ticket_close"
      ) {

        const member =
          interaction.member;

        const channel =
          interaction.channel;

        const guildData =
          getGuildData(
            interaction.guild.id
          );

        const ticket =
          guildData.tickets[
            channel.id
          ];

        if (!ticket) {

          return interaction.reply({

            content:
              "❌ هذه ليست تكت.",

            ephemeral: true

          });

        }

        // صاحب التكت ممنوع

        if (
          ticket.ownerId ===
          member.id
        ) {

          return interaction.reply({

            content:
              "❌ لا يمكنك إغلاق التكت التي فتحتها.",

            ephemeral: true

          });

        }

        if (!isStaff(member)) {

          return interaction.reply({

            content:
              "❌ الإدارة فقط تستطيع إغلاق التكت.",

            ephemeral: true

          });

        }

        await interaction.reply({

          content:
            "🔒 سيتم إغلاق التكت خلال 5 ثوانٍ..."

        });

        setTimeout(
          async () => {

            delete guildData.tickets[
              channel.id
            ];

            saveData();

            await channel
              .delete()
              .catch(() => {});

          },
          5000
        );

        return;
      }
    }

    // =================================================
    // Slash Commands
    // =================================================

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    // =================================================
    // /ip
    // =================================================

    if (
      interaction.commandName ===
      "ip"
    ) {

      const embed =
        new EmbedBuilder()

          .setTitle(
            `🌐 ${SERVER_NAME}`
          )

          .setDescription(
            `**IP السيرفر:**\n\`${SERVER_IP}\``
          );

      return interaction.reply({
        embeds: [
          embed
        ]
      });
    }

    // =================================================
    // /points
    // =================================================

    if (
      interaction.commandName ===
      "points"
    ) {

      const points =
        getPoints(
          interaction.guild.id,
          interaction.user.id
        );

      const rank =
        getRankByPoints(points);

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle(
              "📊 نقاط الإدارة"
            )

            .setDescription(

              `👤 **العضو:** ${interaction.user}\n\n` +

              `⭐ **النقاط:** ${points}\n\n` +

              `🏆 **الرتبة المستحقة:** ${rank}`

            )

        ],

        ephemeral: true

      });
    }

    // =================================================
    // /salary
    // =================================================

    if (
      interaction.commandName ===
      "salary"
    ) {

      const member =
        interaction.member;

      if (
        !isSeniorStaff(member)
      ) {

        return interaction.reply({

          content:
            "❌ الراتب متاح من **Sr Mod** فما فوق.",

          ephemeral: true

        });

      }

      const guildData =
        getGuildData(
          interaction.guild.id
        );

      const now =
        Date.now();

      const last =
        Number(
          guildData.salary[
            member.id
          ] || 0
        );

      const DAY =
        24 * 60 * 60 * 1000;

      if (
        now - last < DAY
      ) {

        const remaining =
          DAY -
          (now - last);

        const hours =
          Math.floor(
            remaining /
              3600000
          );

        const minutes =
          Math.floor(
            (remaining %
              3600000) /
              60000
          );

        return interaction.reply({

          content:
            `❌ استلمت راتبك مسبقاً.\n` +
            `⏰ المتبقي: **${hours} ساعة و ${minutes} دقيقة**`,

          ephemeral: true

        });

      }

      guildData.salary[
        member.id
      ] = now;

      const points =
        addPoints(
          interaction.guild.id,
          member.id,
          12
        );

      await updateStaffRank(
        member
      );

      return interaction.reply({

        embeds: [

          new EmbedBuilder()

            .setTitle(
              "💰 راتب الإدارة"
            )

            .setDescription(

              `✅ تم استلام الراتب.\n\n` +

              `⭐ **+12 نقطة**\n\n` +

              `📊 نقاطك الآن: **${points}**`

            )

        ]

      });
    }

    // =================================================
    // /claim
    // =================================================

    if (
      interaction.commandName ===
      "claim"
    ) {

      const member =
        interaction.member;

      if (!isStaff(member)) {

        return interaction.reply({

          content:
            "❌ هذا الأمر للإدارة فقط.",

          ephemeral: true

        });

      }

      const guildData =
        getGuildData(
          interaction.guild.id
        );

      const ticket =
        guildData.tickets[
          interaction.channel.id
        ];

      if (!ticket) {

        return interaction.reply({

          content:
            "❌ استخدم الأمر داخل التكت.",

          ephemeral: true

        });

      }

      if (
        ticket.ownerId ===
        member.id
      ) {

        return interaction.reply({

          content:
            "❌ لا يمكنك استلام التكت التي فتحتها.",

          ephemeral: true

        });

      }

      if (
        ticket.claimedBy &&
        ticket.claimedBy !==
          member.id
      ) {

        return interaction.reply({

          content:
            `❌ التكت مستلمة بواسطة <@${ticket.claimedBy}>.`,

          ephemeral: true

        });

      }

      if (
        !ticket.claimCount[
          member.id
        ]
      ) {

        ticket.claimCount[
          member.id
        ] = 0;

      }

      ticket.claimCount[
        member.id
      ]++;

      if (
        ticket.claimCount[
          member.id
        ] === 1
      ) {

        ticket.claimedBy =
          member.id;

        const points =
          addPoints(
            interaction.guild.id,
            member.id,
            3
          );

        await updateStaffRank(
          member
        );

        return interaction.reply({

          content:
            `✅ تم استلام التكت.\n` +
            `⭐ **+3 نقاط**\n` +
            `📊 نقاطك: **${points}**`

        });

      }

      const points =
        addPoints(
          interaction.guild.id,
          member.id,
          -50
        );

      return interaction.reply({

        content:
          `⚠️ Claim ثاني لنفس التكت.\n` +
          `❌ **-50 نقطة**\n` +
          `📊 نقاطك: **${points}**`

      });
    }

    // =================================================
    // /warn
    // =================================================

    if (
      interaction.commandName ===
      "warn"
    ) {

      const member =
        interaction.member;

      if (
        !isSeniorStaff(member)
      ) {

        return interaction.reply({

          content:
            "❌ أمر Warn متاح من **Sr Mod** فما فوق.",

          ephemeral: true

        });

      }

      const target =
        interaction.options.getMember(
          "member"
        );

      const reason =
        interaction.options.getString(
          "reason"
        );

      if (!target) {

        return interaction.reply({

          content:
            "❌ لم أجد العضو.",

          ephemeral: true

        });

      }

      const embed =
        new EmbedBuilder()

          .setTitle(
            "⚠️ تحذير"
          )

          .setDescription(

            `👤 **العضو:** ${target}\n` +

            `🛡️ **بواسطة:** ${member}\n` +

            `📝 **السبب:** ${reason}`

          )

          .setFooter({
            text: SERVER_NAME
          });

      return interaction.reply({
        embeds: [
          embed
        ]
      });
    }

    // =================================================
    // /staffrequest
    // =================================================

    if (
      interaction.commandName ===
      "staffrequest"
    ) {

      const member =
        interaction.member;

      if (!isStaff(member)) {

        return interaction.reply({

          content:
            "❌ هذا الأمر للإدارة فقط.",

          ephemeral: true

        });

      }

      const mentions = [];

      for (
        const roleName of
        SENIOR_STAFF_ROLES
      ) {

        const role =
          interaction.guild.roles.cache.find(
            r =>
              r.name.toLowerCase() ===
              roleName.toLowerCase()
          );

        if (role) {

          mentions.push(
            `<@&${role.id}>`
          );

        }

      }

      return interaction.reply({

        content:
          `📢 **طلب حضور الإدارة**\n\n` +
          `<@${member.id}> يحتاج حضور الإدارة.\n\n` +
          mentions.join(" ")

      });
    }

    // =================================================
    // /setup-ticket
    // =================================================

    if (
      interaction.commandName ===
      "setup-ticket"
    ) {

      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      ) {

        return interaction.reply({

          content:
            "❌ هذا الأمر للأدمن فقط.",

          ephemeral: true

        });

      }

      const embed =
        new EmbedBuilder()

          .setTitle(
            `🎫 تذاكر الدعم | ${SERVER_NAME}`
          )

          .setDescription(

            "اضغط على الزر بالأسفل لفتح تكت.\n\n" +

            "سيتم إنشاء تكت خاصة بك وإشعار الإدارة."

          );

      const row =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()

              .setCustomId(
                "open_ticket"
              )

              .setLabel(
                "فتح تكت"
              )

              .setEmoji("🎫")

              .setStyle(
                ButtonStyle.Success
              )

          );

      return interaction.reply({

        embeds: [
          embed
        ],

        components: [
          row
        ]

      });
    }
  }
);

// =====================================================
// تشغيل
// =====================================================

client.login(TOKEN);
